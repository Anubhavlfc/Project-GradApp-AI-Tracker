import { createElement, lazy, type ComponentType, type LazyExoticComponent } from 'react';

type Module = { default: ComponentType };

/**
 * Loads a component's code the first time it is needed, like React.lazy, with two differences
 * that matter here:
 *
 * - Once the code has arrived the component renders straight away, without suspending again, so
 *   nobody sees a loading flash for code they already have (and tests can preload it and render
 *   synchronously).
 * - `preload()` starts the download early, for example when a person is about to sign in. If that
 *   early attempt fails it is forgotten, so the screen that needs the code tries once more.
 *
 * A download that fails while the screen is waiting for it is an error like any other: the error
 * boundary shows it, and reloading the page is what fixes it.
 */
export function lazyComponent(load: () => Promise<Module>) {
  let loaded: ComponentType | null = null;
  let loading: Promise<Module> | null = null;
  let suspending: LazyExoticComponent<ComponentType> | null = null;

  function start(): Promise<Module> {
    loading ??= load().then(
      (module) => {
        loaded = module.default;
        return module;
      },
      (error: unknown) => {
        loading = null;
        throw error;
      },
    );
    return loading;
  }

  async function preload(): Promise<void> {
    await start();
  }

  function Lazy() {
    if (loaded !== null) return createElement(loaded);
    suspending ??= lazy(start);
    return createElement(suspending);
  }

  return Object.assign(Lazy, { preload });
}
