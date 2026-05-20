# Cpk Process Capability

Domain: sixsigma
Topic: Cpk
Authority: canonical
Trust score: 0.92

## Canonical answer

Cpk measures how capable a process is of meeting specification limits while accounting for how centered the process mean is. It compares the process mean to the nearest specification limit in units of three standard deviations.

## Formula

Cpu = (USL - mean) / (3 * standard deviation)
Cpl = (mean - LSL) / (3 * standard deviation)
Cpk = min(Cpu, Cpl)

## Interpretation

- Cpk below 1.00 usually means the process is not capable of reliably meeting specifications.
- Cpk around 1.33 is a common minimum capability target.
- Cpk around 1.67 or higher is often treated as strong capability for critical processes.
- Cp measures potential capability if the process is centered; Cpk measures actual capability after centering is considered.

## Sources

- Six Sigma process capability curriculum
- Blackbelt calculator knowledge records
