package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/init-co-jp/diff-tour/internal/config"
	"github.com/init-co-jp/diff-tour/internal/generate"
	"github.com/init-co-jp/diff-tour/internal/git"
	"github.com/init-co-jp/diff-tour/internal/i18n"
)

type headlessArgs struct {
	positional []string
	cfg        *config.Config
	cfgErr     error
	repoDir    string
	lang       string
	llm        string
	count      bool
}

// emitter writes one JSON object per line. Nothing else may write to stdout in --json mode.
type emitter struct {
	mu  sync.Mutex
	enc *json.Encoder
}

func newEmitter(w io.Writer) *emitter { return &emitter{enc: json.NewEncoder(w)} }

func (e *emitter) emit(typ string, fields map[string]any) {
	e.mu.Lock()
	defer e.mu.Unlock()
	m := map[string]any{"v": 1, "type": typ}
	for k, v := range fields {
		m[k] = v
	}
	_ = e.enc.Encode(m)
}

func (e *emitter) fail(code, msg string, extra map[string]any) error {
	f := map[string]any{"code": code, "message": msg}
	for k, v := range extra {
		f[k] = v
	}
	e.emit("error", f)
	return errors.New(msg)
}

// classifyRead turns a path the LLM read (relative to the export dir) into a repo path and a tag.
func classifyRead(detail string, changed map[string]bool) (path, tag string) {
	p := filepath.ToSlash(detail)
	if rest, ok := strings.CutPrefix(p, "base/"); ok {
		return rest, "BASE"
	}
	if rest, ok := strings.CutPrefix(p, "head/"); ok {
		if !changed[rest] {
			return rest, "NOT_IN_DIFF"
		}
		return rest, ""
	}
	return p, ""
}

func classify(ctx context.Context, err error) string {
	var inv *generate.InvalidTourError
	msg := strings.ToLower(err.Error())
	switch {
	case ctx.Err() != nil:
		return "cancelled"
	case errors.As(err, &inv):
		return "invalid_tour"
	case strings.HasPrefix(msg, "export "):
		return "git"
	}
	for _, s := range []string{"login", "logged in", "not authenticated", "authentication", "api key"} {
		if strings.Contains(msg, s) {
			return "not_signed_in"
		}
	}
	return "llm"
}

func runHeadless(out io.Writer, a headlessArgs) error {
	em := newEmitter(out)
	usageErr := func(msg string) error { return em.fail("usage", msg, nil) }
	if a.cfgErr != nil {
		return usageErr(a.cfgErr.Error())
	}
	if len(a.positional) != 1 {
		return usageErr("exactly one target is required")
	}
	target := a.positional[0]
	if target == "setup" || strings.HasSuffix(target, ".json") {
		return usageErr("--json supports only a ref, branch, commit or range")
	}

	dir, err := filepath.Abs(a.repoDir)
	if err != nil {
		return usageErr(err.Error())
	}
	repo := git.Open(dir)
	if repo.RevParse("HEAD") == "" {
		return em.fail("git", i18n.T("err.notRepo", dir), nil)
	}
	base, head, err := resolve(repo, target)
	if err != nil {
		return em.fail("git", err.Error(), nil)
	}

	// Same numbers for --count and the done event.
	baseSha, headSha := repo.MergeBase(base, head), repo.RevParse(head)
	stats := repo.FileStats(base, head)
	changed := map[string]bool{}
	for _, f := range stats {
		changed[f.File] = true
	}
	if a.count {
		em.emit("count", map[string]any{"files": len(stats), "base": base, "head": head, "baseSha": baseSha, "headSha": headSha})
		return nil
	}

	var lang i18n.Lang
	switch {
	case a.lang != "":
		l, ok := i18n.Parse(a.lang)
		if !ok {
			return usageErr("unsupported language: " + a.lang)
		}
		lang = l
	case a.cfg != nil:
		lang, _ = i18n.Parse(a.cfg.Lang)
	default:
		return usageErr("--lang is required when no config exists")
	}
	llm := a.llm
	if llm == "" && a.cfg != nil {
		llm = a.cfg.LLM
	}
	if llm == "" {
		return usageErr("--llm is required when no config exists")
	}
	backend, err := backendFor(llm)
	if err != nil {
		return usageErr(err.Error())
	}
	i18n.Set(lang)


	joinKillOnCloseJob()

	key := generate.CacheKey(repo, base, head, lang, backend.Name())
	path, err := generate.CachePath(key)
	if err != nil {
		return em.fail("llm", err.Error(), nil)
	}
	done := func(cached bool) {
		em.emit("done", map[string]any{"key": key, "path": path, "base": base, "head": head, "baseSha": baseSha, "headSha": headSha, "files": len(stats), "cached": cached})
	}
	stage := func(s, state string) { em.emit("stage", map[string]any{"stage": s, "state": state}) }

	if t, err := generate.LoadCached(key); err == nil && t != nil {
		stage("show", "done")
		done(true)
		return nil
	}

	work, err := generate.WorkDir(key)
	if err != nil {
		return em.fail("llm", err.Error(), nil)
	}
	sweepStale(filepath.Dir(work))

	// Cancel: signals, or stdin closed by the caller (callers must keep stdin open for the whole run).
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		_, _ = io.Copy(io.Discard, os.Stdin)
		cancel()
	}()

	fmt.Fprintf(os.Stderr, "tour: generating %s..%s with %s\n", base, head, backend.Name())
	stage("export", "active")
	writeActive, checkActive := false, false
	progress := func(p generate.Progress) {
		switch {
		case p.Event != nil:
			tool := p.Event.Tool
			if tool == "" {
				tool = map[string]string{"read": "Read", "search": "Grep"}[p.Event.Kind]
			}
			path, tag := p.Event.Detail, ""
			if p.Event.Kind == "read" {
				path, tag = classifyRead(p.Event.Detail, changed)
			}
			em.emit("read", map[string]any{"tool": tool, "path": path, "tag": tag})
		case p.Phase == "reading":
			stage("export", "done")
			stage("write", "active")
			writeActive = true
		case p.Phase == "checking":
			if writeActive {
				stage("write", "done")
				writeActive = false
			}
			if !checkActive {
				stage("check", "active")
				checkActive = true
			}
		case p.Phase == "repairing":
			em.emit("repair", map[string]any{"attempt": p.Repair})
			stage("write", "active")
			writeActive = true
		}
	}
	t, st, err := generate.Generate(ctx, backend, generate.Request{Repo: repo, Base: base, Head: head, Lang: lang}, work, progress)
	if err != nil {
		var extra map[string]any
		var inv *generate.InvalidTourError
		if errors.As(err, &inv) {
			extra = map[string]any{"problems": inv.Problems}
		}
		return em.fail(classify(ctx, err), err.Error(), extra)
	}
	stage("check", "done")
	stage("show", "active")
	if err := generate.SaveCached(key, t); err != nil {
		return em.fail("llm", err.Error(), nil)
	}
	stage("show", "done")
	fmt.Fprintf(os.Stderr, "tour: done, cost $%.4f, %d repairs\n", st.CostUSD, st.Repairs)
	done(false)
	return nil
}

// sweepStale removes export dirs left by a hard-killed run.
// shortcut: generation never runs an hour, so older dirs are garbage; upgrade if runs get longer.
func sweepStale(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if info, err := e.Info(); err == nil && time.Since(info.ModTime()) > time.Hour {
			_ = os.RemoveAll(filepath.Join(dir, e.Name()))
		}
	}
}
