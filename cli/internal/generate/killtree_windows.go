//go:build windows

package generate

import (
	"os/exec"
	"strconv"
)

// killTree kills the process and its children (claude.cmd spawns node, which spawns more).
func killTree(cmd *exec.Cmd) error {
	if err := exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(cmd.Process.Pid)).Run(); err != nil {
		return cmd.Process.Kill()
	}
	return nil
}
