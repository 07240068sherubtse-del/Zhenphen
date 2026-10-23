const donationPreviewNotice = 'Preview only \u2014 donations are not available yet. No information or payments will be submitted.';

function donationDisplayPreview(markup) {
  return markup
    .replace(/<form data-form="(money|clothes)">/g, (_, type) => `<div data-donation-preview="${type}" aria-disabled="true"><p class="donation-preview-notice" role="note">${donationPreviewNotice}</p>`)
    .replace(/<\/form>/g, '</div>')
    .replace(/<(input|select|textarea|button)\b([^>]*)>/g, (_, tag, attributes) => {
      const passive = attributes.replace(/\s(?:name|data-form|data-tab|data-amount|tabindex|aria-selected|aria-pressed)="[^"]*"/g, '');
      return `<${tag}${passive}${/\sdisabled(?:\s|$)/.test(passive) ? '' : ' disabled'} tabindex="-1">`;
    })
    .replace(/role="tablist"/g, 'role="group" data-donation-tabs')
    .replace(/\srole="tab"/g, '')
    .replace(/role="tabpanel"/g, 'role="region"')
    .replace(/(id="(?:money|clothes)-panel"[^>]*?)\shidden/g, '$1')
    .replace(/(class="custom-amount field")\shidden/g, '$1')
    .replace('Financial and clothing forms below are interactive previews. A secure payment and handover service is not connected.', 'Financial and clothing donations are display-only previews. All donation controls are disabled.')
    .replace('Choose an amount and enter the details for your demo history.', 'Preview the financial donation options below. Donations are not available yet.')
    .replace('Tell us what you would like to contribute.', 'Preview the clothing donation options below. Item donations are not available yet.')
    .replace('Choose an amount and preview how a contribution would be recorded.', 'View a display-only preview of financial donation options.')
    .replace('Register clean, wearable clothing or essentials for the demo.', 'View a display-only preview of clothing and essential items.')
    .replace('href="clothd.html"', 'href="#clothes-panel"');
}

// Native disabled controls are the first barrier; stop synthetic events too.
for (const type of ['click', 'keydown', 'input', 'change', 'submit']) {
  document.addEventListener(type, event => {
    if (document.body.dataset.page !== 'donation') return;
    if (!event.target.closest('[data-donation-preview], [data-donation-tabs]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
