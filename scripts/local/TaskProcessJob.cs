using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

// The task owns this handle. Even forced termination of PowerShell closes it and kills
// the complete Node process tree, rather than leaving an untracked server on port 3001.
public static class ChatbotTaskProcessJob
{
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits
    {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinWorkingSet, MaxWorkingSet;
        public uint ActiveProcesses;
        public UIntPtr Affinity;
        public uint Priority, Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits
    {
        public BasicLimits Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(SafeFileHandle job, int type, ref ExtendedLimits info, uint length);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(SafeFileHandle job, IntPtr process);

    public static int Run(string executable, string script, string root, string log)
    {
        using (SafeFileHandle job = CreateJobObject(IntPtr.Zero, null))
        {
            if (job.IsInvalid) throw new System.ComponentModel.Win32Exception();
            var limits = new ExtendedLimits();
            limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits)))
                throw new System.ComponentModel.Win32Exception();
            using (var writer = new StreamWriter(log, true))
            using (var process = new Process())
            {
                writer.AutoFlush = true;
                process.StartInfo = new ProcessStartInfo(executable, "\"" + script + "\"") {
                    WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                    RedirectStandardOutput = true, RedirectStandardError = true
                };
                DataReceivedEventHandler write = (sender, message) => {
                    if (message.Data != null) lock (writer) writer.WriteLine(message.Data);
                };
                process.OutputDataReceived += write;
                process.ErrorDataReceived += write;
                process.Start();
                if (!AssignProcessToJobObject(job, process.Handle)) {
                    process.Kill();
                    throw new System.ComponentModel.Win32Exception();
                }
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                process.WaitForExit();
                return process.ExitCode;
            }
        }
    }
}
