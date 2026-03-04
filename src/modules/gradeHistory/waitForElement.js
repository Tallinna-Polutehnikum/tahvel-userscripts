export async function waitForElement(selector) {
  return new Promise(resolve => {
    const element = document.querySelector(selector);

    // Return if already present
    if (element) return resolve(element);

    // Observe DOM changes
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        observer.disconnect();
      };
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
};