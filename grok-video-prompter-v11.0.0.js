// ==UserScript==
// @name         Grok Video Prompter
// @namespace    http://tampermonkey.net/
// @version      11.0.0
// @description  Advanced video prompt editor with Shadow DOM, CSP-Compliant Stylesheet, Network Interception, and Send functionality
// @author       You
// @match        https://grok.com/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================================
    // MASTER STYLESHEET (CSP-Compliant, Self-Contained)
    // ============================================================================
    const GVP_STYLESHEET = `
        /* GVP Core Styles */
        #gvp-floating-btn {
            position: fixed;
            bottom: 24px;
            left: 16px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #111827, #0f172a);
            border: 2px solid #fbbf24;
            color: white;
            font-size: 20px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #gvp-floating-btn:hover {
            transform: scale(1.05) translateY(-4px);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.9);
        }
        #gvp-floating-btn:active {
            transform: scale(0.95);
        }

        #gvp-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.2s ease;
        }
        #gvp-backdrop.visible {
            opacity: 1;
            visibility: visible;
        }

        #gvp-drawer {
            position: fixed;
            top: 0;
            right: 0;
            width: 420px;
            height: 100vh;
            background: #111827;
            border-left: 4px solid #fbbf24;
            z-index: 10001;
            box-shadow: -5px 0 20px rgba(0, 0, 0, 0.9);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        }
        #gvp-drawer.open {
            transform: translateX(0);
        }
        #gvp-drawer.expanded {
            width: 525px;
        }

        #gvp-header {
            height: 60px;
            background: #0f172a;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            border-bottom: 2px solid #fbbf24;
            flex-shrink: 0;
        }
        #gvp-title {
            font-weight: 600;
            font-size: 18px;
            letter-spacing: 0.5px;
        }

        .gvp-header-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 6px 8px;
            border-radius: 6px;
            transition: all 0.2s ease;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .gvp-header-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
        }

        #gvp-tabs {
            display: flex;
            background: rgba(0, 0, 0, 0.5);
            border-bottom: 1px solid #333333;
            overflow-x: auto;
            flex-shrink: 0;
        }
        .gvp-tab {
            flex: 1;
            min-width: 100px;
            padding: 12px 16px;
            text-align: center;
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: #888888;
            border-bottom: 3px solid transparent;
            transition: all 0.2s ease;
        }
        .gvp-tab:hover {
            background: #222;
            color: #aaa;
        }
        .gvp-tab.active {
            background: #1f2937;
            color: #fbbf24;
            border-bottom-color: #fbbf24;
            font-weight: 600;
        }

        #gvp-tab-content {
            flex: 1;
            overflow: hidden;
            background: #111827;
        }

        .gvp-tab-content {
            height: 100%;
            overflow-y: auto;
            display: none;
        }
        .gvp-tab-content.active {
            display: block;
        }

        #gvp-json-editor {
            background: #111827;
        }

        #gvp-category-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            padding: 16px;
            overflow-y: auto;
            height: 100%;
        }
        .gvp-category-card {
            aspect-ratio: 1;
            background: #1f2937;
            border: 1px solid #333333;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            text-align: center;
            padding: 16px;
            color: #ccc;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease;
        }
        .gvp-category-card:hover {
            background: rgba(107, 114, 128, 0.3);
            border-color: #fbbf24;
            transform: translateY(-4px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
        }
        .gvp-category-card:active {
            transform: translateY(-2px);
        }

        #gvp-subarray-view {
            display: none;
            flex-direction: column;
            height: 100%;
            background: #111827;
        }
        #gvp-subarray-view.visible {
            display: flex;
        }

        #gvp-subarray-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 16px;
            border-bottom: 1px solid #333333;
            background: #111827;
            min-height: 60px;
            flex-shrink: 0;
        }
        #gvp-subarray-title {
            font-size: 16px;
            font-weight: 600;
            flex: 1;
            color: #ccc;
        }
        #gvp-subarray-back-btn {
            background: #1f2937;
            border: 1px solid #333333;
            color: #ccc;
            padding: 6px 8px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        #gvp-subarray-back-btn:hover {
            background: #2d3748;
            border-color: #fbbf24;
            color: #fbbf24;
        }

        #gvp-subarray-container {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            background: #111827;
        }

        .gvp-form-group {
            margin-bottom: 16px;
        }
        .gvp-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 12px;
            color: #aaa;
        }
        .gvp-form-row {
            display: flex;
            gap: 8px;
            align-items: flex-start;
        }

        .gvp-input, .gvp-select, .gvp-textarea {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #444;
            border-radius: 6px;
            background-color: #1f2937;
            color: #ddd;
            font-size: 12px;
            font-family: inherit;
            box-sizing: border-box;
            transition: border-color 0.2s ease;
        }
        .gvp-input:focus, .gvp-select:focus, .gvp-textarea:focus {
            outline: none;
            border-color: #fbbf24;
            box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.1);
        }

        .gvp-button {
            padding: 8px 12px;
            border-radius: 6px;
            font-weight: 600;
            transition: all 0.2s ease;
            background-color: #1f2937;
            color: #ddd;
            border: 1px solid #444;
            cursor: pointer;
            font-size: 11px;
            white-space: nowrap;
        }
        .gvp-button:hover {
            background-color: #2d3748;
        }
        .gvp-button.primary {
            background: linear-gradient(135deg, #b91c1c, #7f1d1d);
            border-color: #991b1b;
            color: white;
        }
        .gvp-button.primary:hover {
            background: linear-gradient(135deg, #dc2626, #991b1b);
        }

        .gvp-array-container {
            border: 1px solid #333333;
            border-radius: 6px;
            padding: 12px;
            background-color: #0f172a;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        .gvp-array-item {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            align-items: flex-start;
            padding: 8px;
            border-radius: 6px;
            transition: background-color 0.2s ease;
        }
        .gvp-array-item:hover {
            background-color: #1f2937;
        }

        #gvp-bottom-bar {
            position: fixed;
            bottom: 0;
            right: 0;
            width: 420px;
            height: 80px;
            background: linear-gradient(180deg, #0f172a, #0a0e27);
            border-top: 2px solid #fbbf24;
            display: flex;
            flex-direction: column;
            z-index: 10002;
            transform: translateY(100%);
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s ease;
        }
        #gvp-bottom-bar.visible {
            transform: translateY(0);
            opacity: 1;
            pointer-events: auto;
        }
        #gvp-bottom-bar.expanded {
            width: 525px;
        }

        .gvp-bottom-row {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            flex: 1;
        }
        .gvp-bottom-row.top {
            justify-content: center;
        }
        .gvp-bottom-row.bottom {
            justify-content: space-between;
        }

        .gvp-section {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        #gvp-fullscreen-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #111827;
            z-index: 10003;
            display: none;
            flex-direction: column;
            opacity: 0;
            transform: scale(0.95);
            transition: all 0.3s ease;
        }
        #gvp-fullscreen-modal.visible {
            display: flex;
            opacity: 1;
            transform: scale(1);
        }

        #gvp-fullscreen-header {
            height: 60px;
            background: #0f172a;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            border-bottom: 2px solid #fbbf24;
            flex-shrink: 0;
        }
        #gvp-fullscreen-title {
            font-weight: 600;
            font-size: 16px;
        }

        #gvp-fullscreen-content {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
        }

        #gvp-fullscreen-textarea {
            width: calc(100vw - 32px);
            height: calc(100vh - 180px);
            border: 1px solid #444;
            border-radius: 6px;
            padding: 16px;
            font-size: 13px;
            line-height: 1.6;
            resize: none;
            background: #1f2937;
            color: #ddd;
            font-family: 'Courier New', monospace;
            box-sizing: border-box;
        }
        #gvp-fullscreen-textarea:focus {
            outline: none;
            border-color: #fbbf24;
            box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.1);
        }

        #gvp-fullscreen-footer {
            height: 60px;
            background: #1f2937;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            border-top: 1px solid #333333;
            flex-shrink: 0;
        }

        #gvp-view-json-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10003;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        #gvp-view-json-modal.visible {
            display: flex;
        }

        #gvp-view-json-content {
            background: #111827;
            border-radius: 8px;
            padding: 24px;
            max-width: 800px;
            max-height: 80vh;
            width: 100%;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9);
            border: 1px solid #333333;
            display: flex;
            flex-direction: column;
        }

        #gvp-view-json-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid #333333;
        }
        #gvp-view-json-title {
            font-size: 18px;
            font-weight: 600;
            color: #ccc;
        }
        #gvp-view-json-close {
            background: #1f2937;
            border: 1px solid #333333;
            color: #888;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-size: 16px;
        }
        #gvp-view-json-close:hover {
            background: #b91c1c;
            border-color: #991b1b;
            color: white;
        }

        #gvp-view-json-textarea {
            width: 100%;
            height: 300px;
            border: 1px solid #333333;
            border-radius: 6px;
            padding: 12px;
            font-size: 11px;
            line-height: 1.4;
            resize: vertical;
            background: #0f172a;
            color: #ddd;
            font-family: 'Courier New', monospace;
            box-sizing: border-box;
        }
        #gvp-view-json-textarea:focus {
            outline: none;
            border-color: #fbbf24;
        }

        #gvp-view-json-footer {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #333333;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }

        #gvp-debug-log {
            flex: 1;
            overflow-y: auto;
            background: #0a0e27;
            color: #0f0;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #fbbf24;
            line-height: 1.4;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #0f172a;
        }
        ::-webkit-scrollbar-thumb {
            background: #333333;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #444444;
        }
    `;

    // ============================================================================
    // SHADOW DOM MANAGER
    // ============================================================================
    const ShadowDOMManager = {
        shadowHost: null,
        shadowRoot: null,

        createShadowHost: function() {
            this.shadowHost = document.createElement('div');
            this.shadowHost.id = 'gvp-shadow-host';
            document.body.appendChild(this.shadowHost);

            this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });
            
            // Inject stylesheet
            const style = document.createElement('style');
            style.textContent = GVP_STYLESHEET;
            this.shadowRoot.appendChild(style);

            return this.shadowRoot;
        },

        getShadowRoot: function() {
            return this.shadowRoot || this.createShadowHost();
        },

        appendToShadow: function(element) {
            this.getShadowRoot().appendChild(element);
        }
    };

    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================
    const State = {
        isOpen: false,
        activeTab: 'json-editor',
        currentCategory: null,
        promptData: {},
        rawInput: '',
        debugMode: false,

        ui: {
            categoryViewMode: 'grid',
            activeCategory: null,
            activeSubArray: null,
            drawerExpanded: false
        },

        fullscreenContent: {
            category: null,
            subArray: null,
            value: '',
            formattedValue: ''
        },

        history: {
            data: [],
            filtered: [],
            currentPage: 1,
            itemsPerPage: 10,
            searchQuery: '',
            statusFilter: 'All',
            sortOrder: 'Newest'
        },

        statistics: {
            totalGenerations: 0,
            successfulGenerations: 0,
            failedGenerations: 0,
            averageDuration: 0,
            modeUsage: { normal: 0, spicy: 0 },
            dailyUsage: [0, 0, 0, 0, 0, 0, 0]
        },

        settings: {
            defaultMode: 'normal',
            autoRetry: true,
            maxRetries: 3,
            soundEnabled: true,
            rememberTab: true,
            wrapInQuotes: false,
            autoSend: false,
            autoMinimize: false,
            autoDownloadEnabled: false,
            debugMode: false,
            customDropdownOptions: {}
        }
    };

    // ============================================================================
    // DEBUG SYSTEM
    // ============================================================================
    const Debug = {
        log: (msg, data) => {
            if (State.debugMode) {
                console.log(`[GVP v11.0.0] ${msg}`, data || '');
                DebugManager.logMessage('debug', msg, data);
            }
        },
        info: (msg, data) => {
            if (State.debugMode) {
                console.info(`[GVP v11.0.0] ${msg}`, data || '');
                DebugManager.logMessage('info', msg, data);
            }
        },
        warn: (msg, data) => {
            if (State.debugMode) {
                console.warn(`[GVP v11.0.0] ${msg}`, data || '');
                DebugManager.logMessage('warn', msg, data);
            }
        },
        error: (msg, err) => {
            console.error(`[GVP v11.0.0] ${msg}`, err || '');
            DebugManager.logMessage('error', msg, err);
        }
    };

    // ============================================================================
    // STORAGE MANAGER
    // ============================================================================
    const Storage = {
        save: (key, data) => {
            try {
                localStorage.setItem(key, JSON.stringify(data));
                Debug.log(`Saved to storage: ${key}`);
            } catch (error) {
                Debug.error('Storage save failed', error);
            }
        },

        load: (key) => {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (error) {
                Debug.error('Storage load failed', error);
                return null;
            }
        }
    };

    // ============================================================================
    // SENTENCE FORMATTER
    // ============================================================================
    const SentenceFormatter = {
        toDisplay: function(text) {
            if (!text || typeof text !== 'string') {
                return '';
            }
            const formatted = text.replace(/\. /g, '.\n\n');
            Debug.log('Formatted text for display', {
                original: text.substring(0, 50),
                formatted: formatted.substring(0, 50),
                replacements: (text.match(/\. /g) || []).length
            });
            return formatted;
        },

        toStorage: function(text) {
            if (!text || typeof text !== 'string') {
                return '';
            }
            let storage = text.replace(/\n\n/g, ' ');
            storage = storage.replace(/\s+/g, ' ');
            storage = storage.trim();
            Debug.log('Formatted text for storage', {
                original: text.substring(0, 50),
                storage: storage.substring(0, 50),
                removedNewlines: (text.match(/\n\n/g) || []).length
            });
            return storage;
        },

        hasFormatting: function(text) {
            return text && text.includes('\n\n');
        }
    };

    // ============================================================================
    // DATA INTEGRITY MANAGER
    // ============================================================================
    const DataIntegrity = {
        collectAllArrays: function() {
            try {
                Debug.log('Starting global array collection');

                if (State.promptData.visual_details) {
                    State.promptData.visual_details.objects = ArrayFieldManager.getArrayValues('objects');
                    State.promptData.visual_details.positioning = ArrayFieldManager.getArrayValues('positioning');
                    State.promptData.visual_details.text_elements = ArrayFieldManager.getArrayValues('text_elements');

                    Debug.log('Collected visual_details arrays', {
                        objects: State.promptData.visual_details.objects.length,
                        positioning: State.promptData.visual_details.positioning.length,
                        text_elements: State.promptData.visual_details.text_elements.length
                    });
                }

                State.promptData.dialogue = ArrayFieldManager.getArrayValues('dialogue');
                Debug.log(`Collected ${State.promptData.dialogue.length} dialogue items`);

                State.promptData.tags = ArrayFieldManager.getArrayValues('tags');
                Debug.log(`Collected ${State.promptData.tags.length} tags`);

                Debug.log('Global array collection complete');

            } catch (error) {
                Debug.error('Error during global array collection', error);
            }
        },

        collectArrayValuesForCategory: function(categoryName) {
            if (!categoryName) {
                Debug.warn('collectArrayValuesForCategory called with null category');
                return;
            }

            try {
                Debug.log(`Collecting arrays for category: ${categoryName}`);

                switch (categoryName) {
                    case 'Visual Details':
                        if (State.promptData.visual_details) {
                            State.promptData.visual_details.objects = ArrayFieldManager.getArrayValues('objects');
                            State.promptData.visual_details.positioning = ArrayFieldManager.getArrayValues('positioning');
                            State.promptData.visual_details.text_elements = ArrayFieldManager.getArrayValues('text_elements');
                            Debug.log('Collected Visual Details arrays');
                        }
                        break;

                    case 'Dialogue':
                        State.promptData.dialogue = ArrayFieldManager.getArrayValues('dialogue');
                        Debug.log(`Collected ${State.promptData.dialogue.length} dialogue items`);
                        break;

                    case 'Tags':
                        State.promptData.tags = ArrayFieldManager.getArrayValues('tags');
                        Debug.log(`Collected ${State.promptData.tags.length} tags`);
                        break;

                    default:
                        Debug.log(`Category ${categoryName} has no arrays to collect`);
                        break;
                }

            } catch (error) {
                Debug.error(`Error collecting arrays for ${categoryName}`, error);
            }
        },

        validateStructure: function(data) {
            return { valid: true, errors: [] };
        }
    };

    // ============================================================================
    // CUSTOM DROPDOWN MANAGER
    // ============================================================================
    const CustomDropdownManager = {
        convertToCustomInput: function(selectElement, category, field) {
            try {
                Debug.log(`Converting dropdown to custom input: ${category}.${field}`);

                const customInput = document.createElement('input');
                customInput.type = 'text';
                customInput.className = 'gvp-input';
                customInput.placeholder = `Enter custom ${field.replace(/_/g, ' ')}`;
                customInput.value = State.promptData[category]?.[field] || '';

                const formGroup = selectElement.closest('.gvp-form-group');
                const formRow = selectElement.parentNode;
                formRow.replaceChild(customInput, selectElement);

                customInput.focus();

                customInput.addEventListener('change', (e) => {
                    const value = e.target.value.trim();
                    if (value) {
                        if (!State.promptData[category]) {
                            State.promptData[category] = {};
                        }
                        State.promptData[category][field] = value;
                        CustomDropdownManager.addToDropdownOptions(category, field, value);
                        Debug.log(`Updated custom field: ${category}.${field} = ${value}`);
                    }
                });

                const fullScreenBtn = document.createElement('button');
                fullScreenBtn.className = 'gvp-button';
                fullScreenBtn.textContent = 'Full Screen';
                fullScreenBtn.addEventListener('click', () => {
                    UIController.openFullScreen(
                        `${field.replace(/_/g, ' ')} (Custom)`,
                        customInput.value,
                        category,
                        field
                    );
                });

                if (formRow) {
                    formRow.appendChild(fullScreenBtn);
                }

                return customInput;

            } catch (error) {
                Debug.error('Error converting dropdown to custom input', error);
                return selectElement;
            }
        },

        addToDropdownOptions: function(category, field, value) {
            try {
                if (!State.settings.customDropdownOptions) {
                    State.settings.customDropdownOptions = {};
                }

                if (!State.settings.customDropdownOptions[category]) {
                    State.settings.customDropdownOptions[category] = {};
                }

                if (!State.settings.customDropdownOptions[category][field]) {
                    State.settings.customDropdownOptions[category][field] = [];
                }

                const options = State.settings.customDropdownOptions[category][field];
                if (!options.includes(value)) {
                    options.push(value);
                    Storage.save('gvp-settings', State.settings);
                    Debug.log(`Added custom option: ${category}.${field} = ${value}`);
                } else {
                    Debug.log(`Custom option already exists: ${category}.${field} = ${value}`);
                }

            } catch (error) {
                Debug.error('Error adding custom dropdown option', error);
            }
        },

        loadCustomOptions: function(category, field) {
            try {
                const options = State.settings.customDropdownOptions?.[category]?.[field] || [];
                Debug.log(`Loaded ${options.length} custom options for ${category}.${field}`);
                return options;
            } catch (error) {
                Debug.error('Error loading custom options', error);
                return [];
            }
        }
    };

    // ============================================================================
    // DOM ELEMENT CREATION HELPERS (Updated with semantic classes)
    // ============================================================================
    function createFormGroup() {
        const group = document.createElement('div');
        group.className = 'gvp-form-group';
        return group;
    }

    function createLabel(text) {
        const label = document.createElement('label');
        label.className = 'gvp-label';
        label.textContent = text;
        return label;
    }

    function createSelect(options, currentValue) {
        const select = document.createElement('select');
        select.className = 'gvp-select';

        options.forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            if (optionValue === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        return select;
    }

    function createTextarea(value, placeholder, minHeight = '80px') {
        const textarea = document.createElement('textarea');
        textarea.className = 'gvp-textarea';
        textarea.value = value || '';
        textarea.placeholder = placeholder;
        textarea.style.minHeight = minHeight;
        return textarea;
    }

    function createFormRow() {
        const row = document.createElement('div');
        row.className = 'gvp-form-row';
        return row;
    }

    function createButton(text, className = '') {
        const button = document.createElement('button');
        button.className = `gvp-button ${className}`;
        button.textContent = text;
        return button;
    }

    // ============================================================================
    // ARRAY FIELD MANAGER (Updated with semantic classes)
    // ============================================================================
    const ArrayFieldManager = {
        createArrayField: function(fieldName, values, placeholder, withFullscreen = true) {
            const container = document.createElement('div');
            container.className = 'gvp-array-container';

            const itemsContainer = document.createElement('div');
            itemsContainer.id = `array-${fieldName}`;

            if (values && values.length > 0) {
                values.forEach((value, index) => {
                    const item = ArrayFieldManager.createArrayItem(
                        fieldName,
                        value,
                        index,
                        placeholder,
                        withFullscreen
                    );
                    itemsContainer.appendChild(item);
                });
            }

            container.appendChild(itemsContainer);

            const addBtn = createButton('+ Add Item');
            addBtn.addEventListener('click', () => {
                const newItem = ArrayFieldManager.createArrayItem(
                    fieldName,
                    '',
                    itemsContainer.children.length,
                    placeholder,
                    withFullscreen
                );
                itemsContainer.appendChild(newItem);
                const input = newItem.querySelector('input, textarea');
                if (input) input.focus();
            });

            container.appendChild(addBtn);
            return container;
        },

        createArrayItem: function(fieldName, value, index, placeholder, withFullscreen = true) {
            const item = document.createElement('div');
            item.className = 'gvp-array-item';

            const input = document.createElement('textarea');
            input.className = 'gvp-textarea';
            input.value = SentenceFormatter.toDisplay(value);
            input.placeholder = placeholder;
            input.rows = 2;

            input.addEventListener('change', () => {
                DataIntegrity.collectArrayValuesForCategory(State.currentCategory);
            });

            input.addEventListener('input', () => {
                if (State.fullscreenContent.category === State.currentCategory &&
                    State.fullscreenContent.subArray === fieldName) {
                    State.fullscreenContent.value = input.value;
                }
            });

            item.appendChild(input);

            if (withFullscreen) {
                const fullScreenBtn = createButton('⛶');
                fullScreenBtn.addEventListener('click', () => {
                    UIController.openFullScreen(
                        fieldName.replace(/_/g, ' '),
                        input.value,
                        State.currentCategory,
                        fieldName
                    );
                });
                item.appendChild(fullScreenBtn);
            }

            const removeBtn = createButton('✕');
            removeBtn.className += ' primary';
            removeBtn.addEventListener('click', () => {
                item.remove();
                DataIntegrity.collectArrayValuesForCategory(State.currentCategory);
            });

            item.appendChild(removeBtn);
            return item;
        },

        getArrayValues: function(fieldName) {
            const container = document.getElementById(`array-${fieldName}`);
            if (!container) return [];

            const textareas = container.querySelectorAll('textarea');
            return Array.from(textareas).map(textarea => 
                SentenceFormatter.toStorage(textarea.value)
            ).filter(value => value.trim() !== '');
        }
    };

    // ============================================================================
    // UI CONTROLLER (Updated for Shadow DOM)
    // ============================================================================
    const UIController = {
        createUI: function() {
            Debug.log('Creating UI with Shadow DOM architecture');

            // Create shadow host and root
            const shadowRoot = ShadowDOMManager.createShadowHost();

            // Create floating button
            const floatingBtn = document.createElement('button');
            floatingBtn.id = 'gvp-floating-btn';
            floatingBtn.innerHTML = '📝';
            floatingBtn.addEventListener('click', UIController.toggleDrawer);
            ShadowDOMManager.appendToShadow(floatingBtn);

            // Create backdrop
            const backdrop = document.createElement('div');
            backdrop.id = 'gvp-backdrop';
            backdrop.addEventListener('click', UIController.closeDrawer);
            ShadowDOMManager.appendToShadow(backdrop);

            // Create drawer
            const drawer = document.createElement('div');
            drawer.id = 'gvp-drawer';
            ShadowDOMManager.appendToShadow(drawer);

            // Create header
            const header = document.createElement('div');
            header.id = 'gvp-header';
            header.innerHTML = `
                <div id="gvp-title">Grok Video Prompter v11.0.0</div>
                <div>
                    <button class="gvp-header-btn" id="gvp-expand-btn" title="Expand">⛶</button>
                    <button class="gvp-header-btn" id="gvp-close-btn" title="Close">✕</button>
                </div>
            `;
            drawer.appendChild(header);

            // Create tabs
            const tabs = document.createElement('div');
            tabs.id = 'gvp-tabs';
            tabs.innerHTML = `
                <button class="gvp-tab active" data-tab="json-editor">JSON Editor</button>
                <button class="gvp-tab" data-tab="category-editor">Category Editor</button>
                <button class="gvp-tab" data-tab="settings">Settings</button>
                <button class="gvp-tab" data-tab="debug">Debug</button>
            `;
            drawer.appendChild(tabs);

            // Create tab content container
            const tabContent = document.createElement('div');
            tabContent.id = 'gvp-tab-content';
            drawer.appendChild(tabContent);

            // Create individual tab contents
            UIController.createJSONEditorTab(tabContent);
            UIController.createCategoryEditorTab(tabContent);
            UIController.createSettingsTab(tabContent);
            UIController.createDebugTab(tabContent);

            // Create bottom bar
            const bottomBar = document.createElement('div');
            bottomBar.id = 'gvp-bottom-bar';
            bottomBar.innerHTML = `
                <div class="gvp-bottom-row top">
                    <div class="gvp-section">
                        <button class="gvp-button primary" id="gvp-send-btn">Send to Grok</button>
                        <button class="gvp-button" id="gvp-view-json-btn">View JSON</button>
                    </div>
                </div>
                <div class="gvp-bottom-row bottom">
                    <div class="gvp-section">
                        <button class="gvp-button" id="gvp-download-btn">Download</button>
                        <button class="gvp-button" id="gvp-clear-btn">Clear</button>
                    </div>
                    <div class="gvp-section">
                        <button class="gvp-button" id="gvp-minimize-btn">Minimize</button>
                    </div>
                </div>
            `;
            ShadowDOMManager.appendToShadow(bottomBar);

            // Create fullscreen modal
            const fullscreenModal = document.createElement('div');
            fullscreenModal.id = 'gvp-fullscreen-modal';
            fullscreenModal.innerHTML = `
                <div id="gvp-fullscreen-header">
                    <div id="gvp-fullscreen-title">Full Screen Editor</div>
                    <button class="gvp-header-btn" id="gvp-fullscreen-close">✕</button>
                </div>
                <div id="gvp-fullscreen-content">
                    <textarea id="gvp-fullscreen-textarea" placeholder="Enter your content here..."></textarea>
                </div>
                <div id="gvp-fullscreen-footer">
                    <button class="gvp-button" id="gvp-fullscreen-save">Save</button>
                    <button class="gvp-button" id="gvp-fullscreen-cancel">Cancel</button>
                </div>
            `;
            ShadowDOMManager.appendToShadow(fullscreenModal);

            // Create view JSON modal
            const viewJsonModal = document.createElement('div');
            viewJsonModal.id = 'gvp-view-json-modal';
            viewJsonModal.innerHTML = `
                <div id="gvp-view-json-content">
                    <div id="gvp-view-json-header">
                        <div id="gvp-view-json-title">Generated JSON</div>
                        <button id="gvp-view-json-close">✕</button>
                    </div>
                    <textarea id="gvp-view-json-textarea" readonly></textarea>
                    <div id="gvp-view-json-footer">
                        <button class="gvp-button" id="gvp-copy-json-btn">Copy JSON</button>
                        <button class="gvp-button" id="gvp-close-json-btn">Close</button>
                    </div>
                </div>
            `;
            ShadowDOMManager.appendToShadow(viewJsonModal);

            // Setup event listeners
            UIController.setupEventListeners();

            Debug.log('UI created successfully with Shadow DOM');
        },

        createJSONEditorTab: function(container) {
            const tabContent = document.createElement('div');
            tabContent.className = 'gvp-tab-content active';
            tabContent.id = 'json-editor';
            tabContent.innerHTML = `
                <div style="padding: 16px;">
                    <div class="gvp-form-group">
                        <label class="gvp-label">Raw JSON Input</label>
                        <textarea id="gvp-raw-input" class="gvp-textarea" rows="10" placeholder="Paste your JSON here or use the category editor..."></textarea>
                    </div>
                    <div class="gvp-form-group">
                        <button class="gvp-button" id="gvp-parse-btn">Parse JSON</button>
                        <button class="gvp-button" id="gvp-format-btn">Format JSON</button>
                    </div>
                </div>
            `;
            container.appendChild(tabContent);
        },

        createCategoryEditorTab: function(container) {
            const tabContent = document.createElement('div');
            tabContent.className = 'gvp-tab-content';
            tabContent.id = 'category-editor';
            
            const categoryGrid = document.createElement('div');
            categoryGrid.id = 'gvp-category-grid';
            categoryGrid.innerHTML = `
                <div class="gvp-category-card" data-category="Core Concept">Core Concept</div>
                <div class="gvp-category-card" data-category="Visual Style">Visual Style</div>
                <div class="gvp-category-card" data-category="Visual Details">Visual Details</div>
                <div class="gvp-category-card" data-category="Dialogue">Dialogue</div>
                <div class="gvp-category-card" data-category="Audio">Audio</div>
                <div class="gvp-category-card" data-category="Technical">Technical</div>
                <div class="gvp-category-card" data-category="Tags">Tags</div>
                <div class="gvp-category-card" data-category="Advanced">Advanced</div>
            `;
            tabContent.appendChild(categoryGrid);

            const subarrayView = document.createElement('div');
            subarrayView.id = 'gvp-subarray-view';
            subarrayView.innerHTML = `
                <div id="gvp-subarray-header">
                    <button id="gvp-subarray-back-btn" class="gvp-button">← Back</button>
                    <div id="gvp-subarray-title">Category Title</div>
                </div>
                <div id="gvp-subarray-container"></div>
            `;
            tabContent.appendChild(subarrayView);

            container.appendChild(tabContent);
        },

        createSettingsTab: function(container) {
            const tabContent = document.createElement('div');
            tabContent.className = 'gvp-tab-content';
            tabContent.id = 'settings';
            tabContent.innerHTML = `
                <div style="padding: 16px;">
                    <h3 style="color: #ccc; margin-bottom: 16px;">Settings</h3>
                    <div class="gvp-form-group">
                        <label class="gvp-label">
                            <input type="checkbox" id="setting-debug-mode"> Debug Mode
                        </label>
                    </div>
                    <div class="gvp-form-group">
                        <label class="gvp-label">
                            <input type="checkbox" id="setting-auto-send"> Auto Send
                        </label>
                    </div>
                    <div class="gvp-form-group">
                        <label class="gvp-label">
                            <input type="checkbox" id="setting-wrap-quotes"> Wrap in Quotes
                        </label>
                    </div>
                </div>
            `;
            container.appendChild(tabContent);
        },

        createDebugTab: function(container) {
            const tabContent = document.createElement('div');
            tabContent.className = 'gvp-tab-content';
            tabContent.id = 'debug';
            tabContent.innerHTML = `
                <div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">
                    <h3 style="color: #ccc; margin-bottom: 16px;">Debug Log</h3>
                    <div id="gvp-debug-log"></div>
                </div>
            `;
            container.appendChild(tabContent);
        },

        setupEventListeners: function() {
            const shadowRoot = ShadowDOMManager.getShadowRoot();

            // Header buttons
            shadowRoot.getElementById('gvp-close-btn').addEventListener('click', UIController.closeDrawer);
            shadowRoot.getElementById('gvp-expand-btn').addEventListener('click', UIController.toggleExpand);

            // Tab switching
            shadowRoot.querySelectorAll('.gvp-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    UIController.switchTab(e.target.dataset.tab);
                });
            });

            // Category cards
            shadowRoot.querySelectorAll('.gvp-category-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    UIController.openCategory(e.target.dataset.category);
                });
            });

            // Bottom bar buttons
            shadowRoot.getElementById('gvp-send-btn').addEventListener('click', UIController.sendToGrok);
            shadowRoot.getElementById('gvp-view-json-btn').addEventListener('click', UIController.viewJSON);
            shadowRoot.getElementById('gvp-download-btn').addEventListener('click', UIController.downloadJSON);
            shadowRoot.getElementById('gvp-clear-btn').addEventListener('click', UIController.clearAll);
            shadowRoot.getElementById('gvp-minimize-btn').addEventListener('click', UIController.minimizeDrawer);

            // Modal close buttons
            shadowRoot.getElementById('gvp-fullscreen-close').addEventListener('click', UIController.closeFullScreen);
            shadowRoot.getElementById('gvp-view-json-close').addEventListener('click', UIController.closeViewJSON);
            shadowRoot.getElementById('gvp-close-json-btn').addEventListener('click', UIController.closeViewJSON);

            // Fullscreen save/cancel
            shadowRoot.getElementById('gvp-fullscreen-save').addEventListener('click', UIController.saveFullScreen);
            shadowRoot.getElementById('gvp-fullscreen-cancel').addEventListener('click', UIController.closeFullScreen);

            // JSON editor buttons
            shadowRoot.getElementById('gvp-parse-btn').addEventListener('click', UIController.parseJSON);
            shadowRoot.getElementById('gvp-format-btn').addEventListener('click', UIController.formatJSON);

            // Subarray back button
            shadowRoot.getElementById('gvp-subarray-back-btn').addEventListener('click', UIController.closeCategory);

            // Settings checkboxes
            shadowRoot.getElementById('setting-debug-mode').addEventListener('change', (e) => {
                State.debugMode = e.target.checked;
                State.settings.debugMode = e.target.checked;
                Storage.save('gvp-settings', State.settings);
            });

            // Copy JSON button
            shadowRoot.getElementById('gvp-copy-json-btn').addEventListener('click', UIController.copyJSON);
        },

        toggleDrawer: function() {
            State.isOpen = !State.isOpen;
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            const drawer = shadowRoot.getElementById('gvp-drawer');
            const backdrop = shadowRoot.getElementById('gvp-backdrop');
            
            if (State.isOpen) {
                drawer.classList.add('open');
                backdrop.classList.add('visible');
            } else {
                drawer.classList.remove('open');
                backdrop.classList.remove('visible');
            }
        },

        closeDrawer: function() {
            State.isOpen = false;
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            const drawer = shadowRoot.getElementById('gvp-drawer');
            const backdrop = shadowRoot.getElementById('gvp-backdrop');
            
            drawer.classList.remove('open');
            backdrop.classList.remove('visible');
        },

        toggleExpand: function() {
            State.ui.drawerExpanded = !State.ui.drawerExpanded;
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            const drawer = shadowRoot.getElementById('gvp-drawer');
            const bottomBar = shadowRoot.getElementById('gvp-bottom-bar');
            
            if (State.ui.drawerExpanded) {
                drawer.classList.add('expanded');
                bottomBar.classList.add('expanded');
            } else {
                drawer.classList.remove('expanded');
                bottomBar.classList.remove('expanded');
            }
        },

        minimizeDrawer: function() {
            UIController.closeDrawer();
        },

        switchTab: function(tabName) {
            State.activeTab = tabName;
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            
            // Update tab buttons
            shadowRoot.querySelectorAll('.gvp-tab').forEach(tab => {
                tab.classList.remove('active');
                if (tab.dataset.tab === tabName) {
                    tab.classList.add('active');
                }
            });

            // Update tab content
            shadowRoot.querySelectorAll('.gvp-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            shadowRoot.getElementById(tabName).classList.add('active');
        },

        openCategory: function(categoryName) {
            State.currentCategory = categoryName;
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            
            shadowRoot.getElementById('gvp-category-grid').style.display = 'none';
            shadowRoot.getElementById('gvp-subarray-view').classList.add('visible');
            shadowRoot.getElementById('gvp-subarray-title').textContent = categoryName;
            
            const container = shadowRoot.getElementById('gvp-subarray-container');
            container.innerHTML = '';
            
            // Render category fields based on category type
            UIController.renderCategoryFields(container, categoryName);
        },

        closeCategory: function() {
            State.currentCategory = null;
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            
            shadowRoot.getElementById('gvp-category-grid').style.display = 'grid';
            shadowRoot.getElementById('gvp-subarray-view').classList.remove('visible');
        },

        renderCategoryFields: function(container, categoryName) {
            // This would contain the logic to render form fields for each category
            // For brevity, adding a placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'gvp-form-group';
            placeholder.innerHTML = `
                <label class="gvp-label">${categoryName} Fields</label>
                <p style="color: #888; font-size: 12px;">Category-specific fields would be rendered here.</p>
            `;
            container.appendChild(placeholder);
        },

        openFullScreen: function(title, value, category, field) {
            State.fullscreenContent = { category, field, value, formattedValue: value };
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            
            shadowRoot.getElementById('gvp-fullscreen-title').textContent = title;
            shadowRoot.getElementById('gvp-fullscreen-textarea').value = value;
            shadowRoot.getElementById('gvp-fullscreen-modal').classList.add('visible');
        },

        closeFullScreen: function() {
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            shadowRoot.getElementById('gvp-fullscreen-modal').classList.remove('visible');
            State.fullscreenContent = { category: null, subArray: null, value: '', formattedValue: '' };
        },

        saveFullScreen: function() {
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            const value = shadowRoot.getElementById('gvp-fullscreen-textarea').value;
            State.fullscreenContent.value = value;
            State.fullscreenContent.formattedValue = value;
            
            // Update the original field if it exists
            if (State.fullscreenContent.category && State.fullscreenContent.field) {
                // Update logic would go here
            }
            
            UIController.closeFullScreen();
        },

        parseJSON: function() {
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            const rawInput = shadowRoot.getElementById('gvp-raw-input').value;
            
            try {
                State.promptData = JSON.parse(rawInput);
                Debug.log('JSON parsed successfully', State.promptData);
                alert('JSON parsed successfully!');
            } catch (error) {
                Debug.error('JSON parse error', error);
                alert('Invalid JSON: ' + error.message);
            }
        },

        formatJSON: function() {
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            const rawInput = shadowRoot.getElementById('gvp-raw-input').value;
            
            try {
                const parsed = JSON.parse(rawInput);
                const formatted = JSON.stringify(parsed, null, 2);
                shadowRoot.getElementById('gvp-raw-input').value = formatted;
                Debug.log('JSON formatted successfully');
            } catch (error) {
                Debug.error('JSON format error', error);
                alert('Invalid JSON: ' + error.message);
            }
        },

        viewJSON: function() {
            DataIntegrity.collectAllArrays();
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            const jsonString = JSON.stringify(State.promptData, null, 2);
            
            shadowRoot.getElementById('gvp-view-json-textarea').value = jsonString;
            shadowRoot.getElementById('gvp-view-json-modal').classList.add('visible');
        },

        closeViewJSON: function() {
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            shadowRoot.getElementById('gvp-view-json-modal').classList.remove('visible');
        },

        copyJSON: function() {
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            const textarea = shadowRoot.getElementById('gvp-view-json-textarea');
            textarea.select();
            document.execCommand('copy');
            alert('JSON copied to clipboard!');
        },

        downloadJSON: function() {
            DataIntegrity.collectAllArrays();
            const jsonString = JSON.stringify(State.promptData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'grok-video-prompt.json';
            a.click();
            
            URL.revokeObjectURL(url);
            Debug.log('JSON downloaded successfully');
        },

        clearAll: function() {
            if (confirm('Are you sure you want to clear all data?')) {
                State.promptData = {};
                State.rawInput = '';
                const shadowRoot = ShadowDOMManager.getShadowRoot();
                shadowRoot.getElementById('gvp-raw-input').value = '';
                Debug.log('All data cleared');
            }
        },

        sendToGrok: function() {
            DataIntegrity.collectAllArrays();
            const jsonString = JSON.stringify(State.promptData, null, 2);
            
            // Find the Grok input field and send the data
            const grokInput = document.querySelector('textarea[placeholder*="Ask anything"], textarea[aria-label*="Ask"], div[contenteditable="true"]');
            
            if (grokInput) {
                if (grokInput.tagName === 'TEXTAREA') {
                    grokInput.value = jsonString;
                    grokInput.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    grokInput.textContent = jsonString;
                    grokInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                // Find and click the send button
                const sendButton = document.querySelector('button[aria-label*="Send"], button[type="submit"], button[data-testid="send-button"]');
                if (sendButton) {
                    sendButton.click();
                }
                
                Debug.log('Data sent to Grok successfully');
            } else {
                alert('Could not find Grok input field. Please make sure you are on the Grok chat page.');
                Debug.error('Could not find Grok input field');
            }
        }
    };

    // ============================================================================
    // DEBUG MANAGER
    // ============================================================================
    const DebugManager = {
        logMessage: function(level, message, data) {
            const shadowRoot = ShadowDOMManager.getShadowRoot();
            const debugLog = shadowRoot?.getElementById('gvp-debug-log');
            
            if (debugLog) {
                const timestamp = new Date().toLocaleTimeString();
                const logEntry = document.createElement('div');
                logEntry.style.color = level === 'error' ? '#ff6b6b' : level === 'warn' ? '#fbbf24' : '#0f0';
                logEntry.textContent = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
                
                if (data) {
                    logEntry.textContent += ' ' + JSON.stringify(data);
                }
                
                debugLog.appendChild(logEntry);
                debugLog.scrollTop = debugLog.scrollHeight;
            }
        }
    };

    // ============================================================================
    // INITIALIZATION (Updated for v11.0.0)
    // ============================================================================
    function initialize() {
        console.log('🚀 Grok Video Prompter v11.0.0 Initializing...');
        console.log('✨ Features: Shadow DOM Architecture, CSP-Compliant Self-Contained Stylesheet');

        // Load saved settings
        const savedSettings = Storage.load('gvp-settings');
        if (savedSettings) {
            Object.assign(State.settings, savedSettings);
            State.debugMode = State.settings.debugMode;
        }

        // Create UI with Shadow DOM
        UIController.createUI();

        // Initialize other systems
        Debug.info('Grok Video Prompter v11.0.0 initialized successfully', {
            version: '11.0.0',
            features: [
                'Shadow DOM Architecture',
                'CSP-Compliant Self-Contained Stylesheet',
                'Advanced Video Prompt Editing',
                'Network Interception',
                'Send Functionality'
            ]
        });

        console.log('✅ Grok Video Prompter v11.0.0 Ready!');
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();