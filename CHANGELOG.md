# Changelog

## 2.0.3

- Fixed live-search focus by suppressing the upstream tree's scheduled result focus during input-driven search updates.
- The suppression is scoped to input-driven search updates only. Programmatic search keeps the upstream focus behavior, while Tab and pointer navigation remain native.
- Added browser regressions that model the upstream updateComplete focus callback and assert there is no transient focus jump while typing, pressing Enter, pressing Shift+Enter, or searching numbers.

## 2.0.2

- Keeps search input focus stable while live search and Enter navigation update the upstream tree
- Restores focus after asynchronous upstream rendering without stealing focus from toolbar buttons
- Adds stronger accessibility and security release guards
- Removes retired product and component-library naming from the complete distribution

## 2.0.0

- preserves search-input focus during result navigation
- Enter advances to the next match and Shift+Enter moves backward
- Previous and Next wrap safely through results
- adds visible search-result count
- replaces low-contrast search highlight backgrounds in both themes
- adds API, feature-flag, and commerce examples
- adds browser-ready CDN distribution files and deployment documentation
- expands production-state and accessibility regression coverage

## 2.0.1

- added a dedicated side-by-side light and dark theme example
- expanded the examples index to surface API, feature flag, ecommerce, theme, and large-payload workflows
- added Medium and LinkedIn-ready visual assets and a professional social media writing kit
- corrected configuration example copy to match Enter and Shift+Enter search navigation
- refreshed package documentation and fixed the Tailwind version wording
