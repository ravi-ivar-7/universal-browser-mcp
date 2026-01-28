<template>
  <div class="h-full w-full bg-slate-50 relative agent-theme" :data-agent-theme="currentTheme">
    <!-- Sidepanel Navigator - only show on element-markers pages -->
    <SidepanelNavigator
      v-if="activeTab !== 'agent-chat'"
      :activeTab="activeTab"
      @change="handleTabChange"
    />

    <!-- Agent Chat Tab -->
    <div v-show="activeTab === 'agent-chat'" class="h-full">
      <AgentChat />
    </div>

    <!-- Element Markers Tab -->
    <div v-show="activeTab === 'element-markers'" class="element-markers-content">
      <div class="px-4 py-4">
        <!-- Toolbar: Search + Add Button -->
        <!-- Toolbar: Search + Add Button -->
        <div class="em-toolbar">
          <div class="em-search-wrapper">
            <svg class="em-search-icon" viewBox="0 0 20 20" width="16" height="16">
              <path
                fill="currentColor"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              />
            </svg>
            <input
              v-model="markerSearch"
              class="em-search-input"
              placeholder="Search markers..."
              type="text"
            />
            <button
              v-if="markerSearch"
              class="em-search-clear"
              type="button"
              @click="markerSearch = ''"
            >
              <svg viewBox="0 0 20 20" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </div>
          <button class="em-add-btn" @click="openMarkerEditor()" title="Add Marker">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path
                fill="currentColor"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              />
            </svg>
          </button>
        </div>

        <!-- Modal: Add/Edit Marker -->
        <div v-if="markerEditorOpen" class="em-modal-overlay" @click.self="closeMarkerEditor">
          <div class="em-modal">
            <div class="em-modal-header">
              <h3 class="em-modal-title">{{ editingMarkerId ? 'Edit Marker' : 'Add Marker' }}</h3>
              <button class="em-modal-close" @click="closeMarkerEditor">
                <svg viewBox="0 0 20 20" width="18" height="18">
                  <path
                    fill="currentColor"
                    d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                  />
                </svg>
              </button>
            </div>
            <form @submit.prevent="saveMarker" class="em-form">
              <div class="em-form-row">
                <div class="em-field">
                  <label class="em-field-label">Name</label>
                  <input
                    v-model="markerForm.name"
                    class="em-input"
                    placeholder="e.g. Login Button"
                    required
                  />
                </div>
              </div>

              <div class="em-form-row em-form-row-multi">
                <div class="em-field">
                  <label class="em-field-label">Selector Type</label>
                  <div class="em-select-wrapper">
                    <select v-model="markerForm.selectorType" class="em-select">
                      <option value="css">CSS Selector</option>
                      <option value="xpath">XPath</option>
                    </select>
                  </div>
                </div>
                <div class="em-field">
                  <label class="em-field-label">Match Type</label>
                  <div class="em-select-wrapper">
                    <select v-model="markerForm.matchType" class="em-select">
                      <option value="prefix">Path Prefix</option>
                      <option value="exact">Exact Match</option>
                      <option value="host">Domain</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="em-form-row">
                <div class="em-field">
                  <label class="em-field-label">Selector</label>
                  <textarea
                    v-model="markerForm.selector"
                    class="em-textarea"
                    placeholder="CSS Selector or XPath"
                    rows="3"
                    required
                  ></textarea>
                </div>
              </div>

              <div class="em-modal-actions">
                <button type="button" class="em-btn em-btn-ghost" @click="closeMarkerEditor">
                  Cancel
                </button>
                <button type="submit" class="em-btn em-btn-primary">
                  {{ editingMarkerId ? 'Update' : 'Save' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Markers List -->
        <div v-if="filteredMarkers.length > 0" class="em-list">
          <div class="em-stats-bar">
            <span class="em-stats-text">
              <template v-if="markerSearch">
                Found <strong>{{ filteredMarkers.length }}</strong> markers (Total:
                {{ markers.length }}, {{ groupedMarkers.length }} domains)
              </template>
              <template v-else>
                Total <strong>{{ markers.length }}</strong> markers,
                <strong>{{ groupedMarkers.length }}</strong> domains
              </template>
            </span>
          </div>

          <div
            v-for="domainGroup in groupedMarkers"
            :key="domainGroup.domain"
            class="em-domain-group"
          >
            <div class="em-domain-header" @click="toggleDomain(domainGroup.domain)">
              <div class="em-domain-info">
                <svg
                  class="em-domain-icon"
                  :class="{ 'em-domain-icon-expanded': expandedDomains.has(domainGroup.domain) }"
                  viewBox="0 0 20 20"
                  width="16"
                  height="16"
                >
                  <path fill="currentColor" d="M6 8l4 4 4-4" />
                </svg>
                <h3 class="em-domain-name">{{ domainGroup.domain }}</h3>
                <span class="em-domain-count">{{ domainGroup.count }} markers</span>
              </div>
            </div>

            <div v-if="expandedDomains.has(domainGroup.domain)" class="em-domain-content">
              <div class="em-content-wrapper">
                <div v-for="urlGroup in domainGroup.urls" :key="urlGroup.url" class="em-url-group">
                  <div class="em-url-header">
                    <svg class="em-url-icon" viewBox="0 0 16 16" width="12" height="12">
                      <path
                        fill="currentColor"
                        d="M4 4a1 1 0 011-1h6a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm2 1v1h4V5H6zm0 3v1h4V8H6z"
                      />
                    </svg>
                    <span class="em-url-path">{{ urlGroup.url }}</span>
                  </div>

                  <div class="em-markers-list">
                    <div v-for="marker in urlGroup.markers" :key="marker.id" class="em-marker-item">
                      <div class="em-marker-row-top">
                        <span class="em-marker-name">{{ marker.name }}</span>
                        <div class="em-marker-actions">
                          <button
                            class="em-action-btn em-action-verify"
                            @click="validateMarker(marker)"
                            title="Validate"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                          <button
                            class="em-action-btn em-action-edit"
                            @click="editMarker(marker)"
                            title="Edit"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            class="em-action-btn em-action-delete"
                            @click="deleteMarker(marker)"
                            title="Delete"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div class="em-marker-row-bottom">
                        <code class="em-marker-selector" :title="marker.selector">{{
                          marker.selector
                        }}</code>
                        <div class="em-marker-tags">
                          <span class="em-tag">{{ marker.selectorType || 'css' }}</span>
                          <span class="em-tag">{{ marker.matchType }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No search results -->
        <div v-else-if="markers.length > 0 && filteredMarkers.length === 0" class="em-empty">
          <p>No matching markers found</p>
          <button class="em-btn em-btn-ghost em-empty-btn" @click="markerSearch = ''">
            Clear Search
          </button>
        </div>

        <!-- Empty state -->
        <div v-else class="em-empty">
          <p>No markers yet</p>
          <button class="em-btn em-btn-primary em-empty-btn" @click="openMarkerEditor()">
            Add Marker
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import type { ElementMarker, UpsertMarkerRequest } from '@/common/element-marker-types';
import AgentChat from './components/AgentChat.vue';
import SidepanelNavigator from './components/SidepanelNavigator.vue';
import { useAgentTheme } from './composables/useAgentTheme';

// Agent theme for consistent styling
const { theme: currentTheme, initTheme } = useAgentTheme();

// Tab state - default to AgentChat
const activeTab = ref<'element-markers' | 'agent-chat'>('agent-chat');

// Handle tab change and update URL for deep linking
function handleTabChange(tab: 'element-markers' | 'agent-chat') {
  activeTab.value = tab;
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  history.replaceState(null, '', url.toString());
}

// Element markers state
const currentPageUrl = ref('');
const markers = ref<ElementMarker[]>([]);
const editingMarkerId = ref<string | null>(null);
const markerForm = ref<UpsertMarkerRequest>({
  url: '',
  name: '',
  selector: '',
  selectorType: 'css',
  matchType: 'prefix',
});
const expandedDomains = ref<Set<string>>(new Set());
const markerSearch = ref('');
const markerEditorOpen = ref(false);

const filteredMarkers = computed(() => {
  const query = markerSearch.value.trim().toLowerCase();
  if (!query) return markers.value;
  return markers.value.filter((m) => {
    const name = (m.name || '').toLowerCase();
    const selector = (m.selector || '').toLowerCase();
    const url = (m.url || '').toLowerCase();
    return name.includes(query) || selector.includes(query) || url.includes(query);
  });
});

const groupedMarkers = computed(() => {
  const groups = new Map<string, Map<string, ElementMarker[]>>();

  for (const marker of filteredMarkers.value) {
    const domain = marker.host || '(Local File)';
    const fullUrl = marker.url || '(Unknown URL)';

    if (!groups.has(domain)) {
      groups.set(domain, new Map());
    }

    const domainGroup = groups.get(domain)!;
    if (!domainGroup.has(fullUrl)) {
      domainGroup.set(fullUrl, []);
    }

    domainGroup.get(fullUrl)!.push(marker);
  }

  return Array.from(groups.entries())
    .map(([domain, urlMap]) => ({
      domain,
      count: Array.from(urlMap.values()).reduce((sum, arr) => sum + arr.length, 0),
      urls: Array.from(urlMap.entries())
        .map(([url, markers]) => ({ url, markers }))
        .sort((a, b) => a.url.localeCompare(b.url)),
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
});

function openMarkerEditor(marker?: ElementMarker) {
  if (marker) {
    editingMarkerId.value = marker.id;
    markerForm.value = {
      url: marker.url,
      name: marker.name,
      selector: marker.selector,
      selectorType: marker.selectorType || 'css',
      listMode: marker.listMode,
      matchType: marker.matchType || 'prefix',
      action: marker.action,
    };
  } else {
    resetForm();
  }
  markerEditorOpen.value = true;
}

function closeMarkerEditor() {
  markerEditorOpen.value = false;
  resetForm();
}

function resetForm() {
  markerForm.value = {
    url: currentPageUrl.value,
    name: '',
    selector: '',
    selectorType: 'css',
    matchType: 'prefix',
  };
  editingMarkerId.value = null;
}

async function loadMarkers() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    currentPageUrl.value = String(tab?.url || '');

    if (!editingMarkerId.value) {
      markerForm.value.url = currentPageUrl.value;
    }

    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_LIST_ALL,
    });

    if (res?.success) {
      markers.value = res.markers || [];
    }
  } catch (e) {
    console.error('Failed to load markers:', e);
  }
}

async function saveMarker() {
  try {
    if (!markerForm.value.selector) return;

    const isEditing = !!editingMarkerId.value;
    if (!isEditing) {
      markerForm.value.url = currentPageUrl.value;
    }

    let res: any;
    if (isEditing) {
      const existingMarker = markers.value.find((m) => m.id === editingMarkerId.value);
      if (existingMarker) {
        const updatedMarker: ElementMarker = {
          ...existingMarker,
          ...markerForm.value,
          id: editingMarkerId.value!,
        };
        res = await chrome.runtime.sendMessage({
          type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_UPDATE,
          marker: updatedMarker,
        });
      }
    } else {
      res = await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_SAVE,
        marker: { ...markerForm.value },
      });
    }

    if (res?.success) {
      closeMarkerEditor();
      await loadMarkers();
    }
  } catch (e) {
    console.error('Failed to save marker:', e);
  }
}

function editMarker(marker: ElementMarker) {
  openMarkerEditor(marker);
}

async function deleteMarker(marker: ElementMarker) {
  try {
    const confirmed = confirm(`Are you sure you want to delete marker "${marker.name}"?`);
    if (!confirmed) return;

    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_DELETE,
      id: marker.id,
    });

    if (res?.success) {
      await loadMarkers();
    }
  } catch (e) {
    console.error('Failed to delete marker:', e);
  }
}

async function validateMarker(marker: ElementMarker) {
  try {
    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_VALIDATE,
      selector: marker.selector,
      selectorType: marker.selectorType || 'css',
      action: 'hover',
      listMode: !!marker.listMode,
    } as any);

    if (res?.tool?.ok !== false) {
      await highlightInTab(marker);
    }
  } catch (e) {
    console.error('Failed to validate marker:', e);
  }
}

async function highlightInTab(marker: ElementMarker) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    await chrome.tabs.sendMessage(tabId, {
      action: 'element_marker_highlight',
      selector: marker.selector,
      selectorType: marker.selectorType || 'css',
      listMode: !!marker.listMode,
    });
  } catch (e) {}
}

function toggleDomain(domain: string) {
  if (expandedDomains.value.has(domain)) {
    expandedDomains.value.delete(domain);
  } else {
    expandedDomains.value.add(domain);
  }
  expandedDomains.value = new Set(expandedDomains.value);
}

watch(activeTab, async (newTab) => {
  if (newTab === 'element-markers') {
    await loadMarkers();
  }
});

watch(markerSearch, (query) => {
  if (!query.trim()) return;
  const domainsToExpand = new Set<string>();
  for (const group of groupedMarkers.value) {
    domainsToExpand.add(group.domain);
  }
  expandedDomains.value = domainsToExpand;
});

onMounted(async () => {
  await initTheme();

  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam === 'element-markers') {
    activeTab.value = 'element-markers';
    await loadMarkers();
  } else if (tabParam === 'agent-chat') {
    activeTab.value = 'agent-chat';
  }
});
</script>

<style scoped>
.element-markers-content {
  padding-bottom: 24px;
  color: var(--ac-text, #262626);
}

.em-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.em-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.em-search-wrapper {
  flex: 1;
  position: relative;
}

.em-search-input {
  width: 100%;
  padding: 8px 32px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
}

.em-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.em-add-btn {
  padding: 8px;
  border-radius: 8px;
  background: var(--accent-primary);
  color: white;
  border: none;
  cursor: pointer;
}

.em-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.em-modal {
  background: var(--bg-card);
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  padding: 16px;
}

.em-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.em-field-label {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
}

.em-input, .em-select, .em-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-input);
}

.em-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.em-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
}

.em-btn-primary {
  background: var(--accent-primary);
  color: white;
}

.em-stats-bar {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.em-domain-group {
  margin-bottom: 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.em-domain-header {
  padding: 10px 12px;
  background: var(--bg-secondary);
  cursor: pointer;
}

.em-domain-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.em-marker-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.em-marker-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.em-marker-name {
  font-weight: 500;
  font-size: 14px;
}

.em-marker-actions {
  display: flex;
  gap: 6px;
}

.em-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
}

.em-marker-selector {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-muted);
  padding: 2px 4px;
  border-radius: 4px;
}
</style>
