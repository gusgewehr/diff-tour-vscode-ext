//go:build !windows

package generate

import "os/exec"

func killTree(cmd *exec.Cmd) error { return cmd.Process.Kill() }
