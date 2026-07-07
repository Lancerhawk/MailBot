const createToast = (message: string, type: 'success' | 'error' | 'info') => {
  if (typeof window === 'undefined') return;

  const el = document.createElement('div');
  
  let iconSvg = '';
  let iconColor = '';
  
  if (type === 'success') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    iconColor = 'text-emerald-500';
  } else if (type === 'error') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    iconColor = 'text-red-500';
  } else {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    iconColor = 'text-sky-500';
  }

  el.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="${iconColor}">${iconSvg}</div>
      <p class="text-sm font-medium text-zinc-100">${message}</p>
    </div>
  `;

  // Apply Tailwind-like styling via inline CSS for guaranteed isolation
  el.style.cssText = `
    position: fixed;
    bottom: 32px;
    right: 32px;
    background: rgba(24, 24, 27, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
    padding: 14px 20px;
    border-radius: 12px;
    z-index: 9999;
    font-family: ui-sans-serif, system-ui, sans-serif;
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  document.body.appendChild(el);

  // Trigger animation
  requestAnimationFrame(() => {
    el.style.transform = 'translateY(0)';
    el.style.opacity = '1';
  });

  setTimeout(() => {
    el.style.transform = 'translateY(20px)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, 4000);
};

export const toast = {
  success: (message: string) => {
    console.log("Success:", message);
    createToast(message, 'success');
  },
  error: (message: string) => {
    console.error("Error:", message);
    createToast(message, 'error');
  },
  info: (message: string) => {
    console.log("Info:", message);
    createToast(message, 'info');
  }
};
