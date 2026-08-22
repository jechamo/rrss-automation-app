class PortAdapterError extends Error {
  constructor() {
    super("El puerto solicitado no es válido.");
    this.name = "PortAdapterError";
    this.code = "INVALID_PORT";
  }
}

export function parseWindowsNetstat(output, port) {
  const expectedSuffix = `:${port}`;
  for (const line of String(output).split(/\r?\n/u)) {
    const columns = line.trim().split(/\s+/u);
    if (
      columns.length >= 5 &&
      columns[0].toUpperCase() === "TCP" &&
      columns[1].endsWith(expectedSuffix) &&
      columns[3].toUpperCase() === "LISTENING"
    ) {
      const pid = Number.parseInt(columns[4], 10);
      if (Number.isInteger(pid) && pid > 0) {
        return { occupied: true, pid };
      }
    }
  }
  return null;
}

/**
 * @param {{inspect: (port: number) => {pid?: number} | null | undefined}} dependencies
 */
export function createPortAdapter({ inspect }) {
  function normalize(port, observation) {
    if (
      observation?.occupied === true ||
      (Number.isInteger(observation?.pid) && observation.pid > 0)
    ) {
      return Object.freeze({
        detected: true,
        port,
        status: "occupied",
        ...(Number.isInteger(observation?.pid) && observation.pid > 0
          ? { pid: observation.pid }
          : {}),
      });
    }

    return Object.freeze({
      detected: true,
      port,
      status: "available",
    });
  }

  function assertPort(port) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new PortAdapterError();
    }
  }

  return Object.freeze({
    /**
     * @param {number} port
     * @returns {{
     *   detected: true,
     *   port: number,
     *   status: "available" | "occupied",
     *   pid?: number
     * }}
     */
    inspect(port) {
      assertPort(port);
      return normalize(port, inspect(port));
    },
    async inspectAsync(port) {
      assertPort(port);
      return normalize(port, await inspect(port));
    },
  });
}
