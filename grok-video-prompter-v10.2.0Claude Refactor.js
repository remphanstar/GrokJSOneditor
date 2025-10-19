// ==UserScript==
// @name         Grok Video Prompter
// @namespace    http://tampermonkey.net/
// @version      10.0.2.0
// @description  Advanced video prompt editor with embedded CSS, Network Interception, and Send functionality
// @author       You
// @match        https://grok.com/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================================
    // INJECT STYLESHEET
    // ============================================================================
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
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
        document.head.appendChild(style);
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
                console.log(`[GVP] ${msg}`, data || '');
                DebugManager.logMessage('debug', msg, data);
            }
        },
        info: (msg, data) => {
            if (State.debugMode) {
                console.info(`[GVP] ${msg}`, data || '');
                DebugManager.logMessage('info', msg, data);
            }
        },
        warn: (msg, data) => {
            if (State.debugMode) {
                console.warn(`[GVP] ${msg}`, data || '');
                DebugManager.logMessage('warn', msg, data);
            }
        },
        error: (msg, err) => {
            console.error(`[GVP] ${msg}`, err || '');
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
            return formatted;
        },

        toStorage: function(text) {
            if (!text || typeof text !== 'string') {
                return '';
            }
            let storage = text.replace(/\n\n/g, ' ');
            storage = storage.replace(/\s+/g, ' ');
            storage = storage.trim();
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
                }
                State.promptData.dialogue = ArrayFieldManager.getArrayValues('dialogue');
                State.promptData.tags = ArrayFieldManager.getArrayValues('tags');
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
                }
            } catch (error) {
                Debug.error('Error adding custom dropdown option', error);
            }
        },

        loadCustomOptions: function(category, field) {
            try {
                const options = State.settings.customDropdownOptions?.[category]?.[field] || [];
                return options;
            } catch (error) {
                Debug.error('Error loading custom options', error);
                return [];
            }
        }
    };

    // ============================================================================
    // DOM ELEMENT CREATION HELPERS
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

    function createButton(text, isPrimary = false) {
        const button = document.createElement('button');
        button.className = isPrimary ? 'gvp-button primary' : 'gvp-button';
        button.textContent = text;
        return button;
    }

    // ============================================================================
    // ARRAY FIELD MANAGER
    // ============================================================================
    const ArrayFieldManager = {
        createArrayField: function(fieldName, values, placeholder, withFullscreen = true) {
            const container = document.createElement('div');
            container.className = 'gvp-array-container';

            const itemsContainer = document.createElement('div');
            itemsContainer.id = `array-${fieldName}`;

            if (values
