package main

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestHeadlessEvents(t *testing.T) {
	var buf bytes.Buffer
	em := newEmitter(&buf)
	em.emit("stage", map[string]any{"stage": "export", "state": "active"})
	em.emit("repair", map[string]any{"attempt": 1})
	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("got %d lines, want 2", len(lines))
	}
	for i, typ := range []string{"stage", "repair"} {
		var m map[string]any
		if err := json.Unmarshal([]byte(lines[i]), &m); err != nil {
			t.Fatal(err)
		}
		if m["v"] != float64(1) || m["type"] != typ {
			t.Fatalf("line %d = %v", i, m)
		}
	}

	changed := map[string]bool{"src/a.go": true}
	for in, want := range map[string][2]string{
		"head/src/a.go": {"src/a.go", ""},
		"head/src/b.go": {"src/b.go", "NOT_IN_DIFF"},
		"base/src/a.go": {"src/a.go", "BASE"},
		`head\src\a.go`: {"src/a.go", ""},
		"change.diff":   {"change.diff", ""},
	} {
		if p, tag := classifyRead(in, changed); p != want[0] || tag != want[1] {
			t.Errorf("classifyRead(%q) = %q, %q; want %q, %q", in, p, tag, want[0], want[1])
		}
	}
}

func TestHeadlessBypassesTTY(t *testing.T) {
	dir := t.TempDir()
	gitIn(t, dir, "init", "-q", "-b", "main")
	commit(t, dir, "a.txt")
	commit(t, dir, "b.txt")

	f, err := os.CreateTemp(t.TempDir(), "out")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	old := os.Stdout
	os.Stdout = f
	defer func() { os.Stdout = old }()

	if err := run([]string{"--json", "--count", "--repo", dir, "HEAD"}); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(f.Name())
	var m struct {
		Type  string `json:"type"`
		Files int    `json:"files"`
	}
	if err := json.Unmarshal(bytes.TrimSpace(b), &m); err != nil || m.Type != "count" || m.Files != 1 {
		t.Fatalf("output %q (err %v)", b, err)
	}
}
