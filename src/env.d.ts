/** Minimal process.env declaration for bundler-injected NODE_ENV. */
declare const process: {
  env: {
    NODE_ENV: string;
  };
};
