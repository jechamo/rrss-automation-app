export function resolveE2EGateStatus(playwrightStatus, runtimeReport) {
  if (playwrightStatus !== 0) return 1;
  if (!runtimeReport || runtimeReport.performedExternalRequests !== 0) return 1;
  return 0;
}
