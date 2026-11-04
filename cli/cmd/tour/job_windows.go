//go:build windows

package main

import (
	"fmt"
	"os"
	"unsafe"

	"golang.org/x/sys/windows"
)

var job windows.Handle // kept open for the process lifetime: closing it kills the members

// joinKillOnCloseJob makes Windows kill our children (claude) if tour.exe is hard-killed.
func joinKillOnCloseJob() {
	h, err := windows.CreateJobObject(nil, nil)
	if err == nil {
		var info windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION
		info.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
		_, err = windows.SetInformationJobObject(h, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info)))
	}
	if err == nil {
		err = windows.AssignProcessToJobObject(h, windows.CurrentProcess())
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "tour: job object unavailable:", err)
		return
	}
	job = h
}
