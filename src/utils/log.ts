const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  debug: "\x1b[35m", // magenta
};

const formatTime = () => {
  return new Date().toLocaleTimeString();
};

const formatMessage = (...args: unknown[]) => {
  return args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
    .join(" ");
};

const log = Object.assign(
  (...args: unknown[]) => {
    log.info(...args);
  },
  {
    info: (...args: unknown[]) => {
      console.log(
        `${colors.dim}[${formatTime()}]${colors.reset} ${colors.info}[INFO]${
          colors.reset
        } ${formatMessage(...args)}`
      );
    },
    warn: (...args: unknown[]) => {
      console.log(
        `${colors.dim}[${formatTime()}]${colors.reset} ${colors.warn}[WARN]${
          colors.reset
        } ${formatMessage(...args)}`
      );
    },
    error: (...args: unknown[]) => {
      console.log(
        `${colors.dim}[${formatTime()}]${colors.reset} ${colors.error}[ERROR]${
          colors.reset
        } ${formatMessage(...args)}`
      );
    },
    debug: (...args: unknown[]) => {
      if (process.env.DEBUG_LOG !== "true") return;
      console.log(
        `${colors.dim}[${formatTime()}]${colors.reset} ${colors.debug}[DEBUG]${
          colors.reset
        } ${formatMessage(...args)}`
      );
    },
  }
);

export default log;
