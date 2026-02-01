import type { SearchProvider, SearchProviderContext, SearchResult, Action } from '../core/types';

interface PageStructureResult {
    element: HTMLElement;
    tagName: string;
    text: string;
    path: string;
}

export function createPageStructureProvider(): SearchProvider<PageStructureResult> {
    const id = 'structure';
    const name = 'Page Structure';
    const icon = '📄';

    // Store references to elements to avoid stale lookups if possible, 
    // though DOM might change.
    // We only ever search the *current* page in the quick panel context.

    async function search(ctx: SearchProviderContext): Promise<SearchResult<PageStructureResult>[]> {
        if (ctx.signal.aborted) return [];

        const query = ctx.query.text.toLowerCase();
        const results: SearchResult<PageStructureResult>[] = [];

        // Select interesting elements
        // H1-H6 for structure
        // inputs, buttons, a for interaction
        // forms for context
        const selector = 'h1, h2, h3, h4, h5, h6, button, input:not([type="hidden"]), a[href], textarea, select';
        const elements = document.querySelectorAll(selector);

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;

            // Skip invisible elements logic could go here (e.g. check offsetParent)
            if (el.offsetParent === null) continue;

            let title = '';
            let subtitle = '';
            let score = 0;

            const tagName = el.tagName.toLowerCase();
            const textContent = (el.innerText || (el as HTMLInputElement).value || '').trim();
            const idAttr = el.id ? `#${el.id}` : '';
            const classAttr = el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '';

            // Construct Title based on type
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                title = textContent || `<${tagName}>`;
                subtitle = `Heading ${tagName.toUpperCase()}`;
                score = 10;
            } else if (tagName === 'button') {
                title = textContent || 'Button';
                subtitle = `Button ${idAttr}${classAttr}`;
                score = 5;
            } else if (tagName === 'a') {
                title = textContent || (el as HTMLAnchorElement).href;
                subtitle = 'Link';
                score = 3;
            } else if (['input', 'textarea', 'select'].includes(tagName)) {
                title = (el as HTMLInputElement).placeholder || (el.previousElementSibling as HTMLElement)?.innerText || 'Input';
                subtitle = `${tagName} ${idAttr}`;
                score = 8; // High priority for inputs (Agent use case)
            } else {
                title = `${tagName} ${idAttr}`;
            }

            // Simple text matching
            const matchText = `${title} ${subtitle} ${textContent}`.toLowerCase();
            if (query && !matchText.includes(query)) {
                continue;
            }

            // Boost score if exact match or structure
            if (tagName.startsWith('h')) score += 5;

            results.push({
                id: `node-${i}`,
                provider: id,
                title: title.slice(0, 60),
                subtitle: subtitle.slice(0, 80),
                icon: getIconForTag(tagName),
                data: {
                    element: el,
                    tagName,
                    text: textContent,
                    path: getSimplePath(el)
                },
                score
            });

            if (results.length >= ctx.limit) break;
        }

        return results;
    }

    function getActions(item: SearchResult<PageStructureResult>): Action<PageStructureResult>[] {
        return [
            {
                id: 'structure.highlight',
                title: 'Scroll to View',
                execute: ({ result }) => {
                    const el = result.data.element;
                    if (el && el.isConnected) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // Flash Highlight
                        const originalTransition = el.style.transition;
                        const originalOutline = el.style.outline;

                        el.style.transition = 'outline 0.2s ease';
                        el.style.outline = '4px solid #facc15'; // Yellow-400

                        setTimeout(() => {
                            el.style.outline = originalOutline;
                            setTimeout(() => {
                                el.style.transition = originalTransition;
                            }, 200);
                        }, 1500);

                        // Focus if input
                        if (['input', 'textarea', 'button', 'select'].includes(result.data.tagName)) {
                            el.focus();
                        }
                    } else {
                        console.warn('Element no longer in DOM');
                    }
                }
            }
        ];
    }

    function getIconForTag(tag: string): string {
        if (tag.startsWith('h')) return '🔖';
        if (tag === 'button') return '🔘';
        if (tag === 'input' || tag === 'textarea') return '✏️';
        if (tag === 'a') return '🔗';
        return '🔹';
    }

    function getSimplePath(el: HTMLElement): string {
        return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');
    }

    return {
        id,
        name,
        icon,
        scopes: ['structure'],
        // Actually user might want to find "Login" button from main search.
        // Let's set includeInAll to true but give it specific priority logic in engine if needed, or rely on score.
        // Actually, searching text "Login" should show Login button if 'structure' is in 'all'.
        includeInAll: true,
        priority: 20,
        maxResults: 500,
        supportsEmptyQuery: true, // Show outline of page on empty
        search,
        getActions
    };
}
