const donationPreviewNotice = 'Preview only \u2014 donations are not available yet. No information or payments will be submitted.';

function donationDisplayPreview(markup) {
  return markup
    .replace('<div class="panel">', `<div class="panel"><p class="donation-preview-notice" role="note">${donationPreviewNotice}</p>`)
    .replace(/<form data-form="(money|clothes)">/g, (_, type) => `<div data-donation-preview="${type}" aria-disabled="true">`)
    .replace(/<\/form>/g, '</div>')
    .replace(/<(input|select|textarea|button)\b([^>]*)>/g, (original, tag, attributes) => {
      if (/role="tab"/.test(attributes)) return original;
      const passive = attributes.replace(/\s(?:name|data-form|data-amount|tabindex)="[^"]*"/g, '');
      return `<${tag}${passive}${/\sdisabled(?:\s|$)/.test(passive) ? '' : ' disabled'} tabindex="-1">`;
    })
    .replace(/<p class="form-note">[\s\S]*?<\/p>/g, '')
    .replace('Financial and clothing forms below are interactive previews. A secure payment and handover service is not connected.', 'Explore the financial and clothing donation options below.')
    .replace('Choose an amount and enter the details for your demo history.', 'Financial giving options for supporting community work.')
    .replace('Tell us what you would like to contribute.', 'Clothing and essential items that can help the community.')
    .replace('Choose an amount and preview how a contribution would be recorded.', 'Explore financial giving options for community support.')
    .replace('Register clean, wearable clothing or essentials for the demo.', 'Explore clothing and essential items for the community.')
    .replace('href="clothd.html"', 'href="#giving-options"');
}

// Native disabled controls are the first barrier; stop synthetic events too.
for (const type of ['click', 'keydown', 'input', 'change', 'submit']) {
  document.addEventListener(type, event => {
    if (document.body.dataset.page !== 'donation') return;
    if (!event.target.closest('[data-donation-preview]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
