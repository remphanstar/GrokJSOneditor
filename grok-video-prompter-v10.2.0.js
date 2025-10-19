// ==UserScript==
// @name         Grok Video Prompter
// @namespace    http://tampermonkey.net/
// @version      10.0.2.0
// @description  Advanced video prompt editor with Twind UI, Network Interception, and Send functionality
// @author       You
// @match        https://grok.com/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

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
                customInput.className = 'w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-gray-700 text-gray-200';
                customInput.placeholder = `Enter custom ${field.replace(/_/g, ' ')}`;
                customInput.value = State.promptData[category]?.[field] || '';

                const formGroup = selectElement.closest('.mb-4');
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
                fullScreenBtn.className = 'px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors text-gray-300';
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
    // DOM ELEMENT CREATION HELPERS
    // ============================================================================
    function createFormGroup() {
        const group = document.createElement('div');
        group.className = 'mb-4';
        return group;
    }

    function createLabel(text) {
        const label = document.createElement('label');
        label.className = 'block mb-2 font-semibold text-sm text-gray-400';
        label.textContent = text;
        return label;
    }

    function createSelect(options, currentValue) {
        const select = document.createElement('select');
        select.className = 'w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-gray-700 text-gray-200';

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
        textarea.className = 'w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-y font-inherit bg-gray-700 text-gray-200';
        textarea.value = value || '';
        textarea.placeholder = placeholder;
        textarea.style.minHeight = minHeight;
        return textarea;
    }

    function createFormRow() {
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-start';
        return row;
    }

    function createButton(text, className) {
        const button = document.createElement('button');
        button.className = `px-4 py-2 rounded-lg font-semibold transition-all ${className}`;
        button.textContent = text;
        return button;
    }

    // ============================================================================
    // ARRAY FIELD MANAGER
    // ============================================================================
    const ArrayFieldManager = {
        createArrayField: function(fieldName, values, placeholder, withFullscreen = true) {
            const container = document.createElement('div');
            container.className = 'border border-gray-700 rounded-lg p-3 bg-gray-800 shadow-sm';

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

            const addBtn = document.createElement('button');
            addBtn.className = 'w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors text-gray-300';
            addBtn.textContent = '+ Add Item';
            addBtn.addEventListener('click', () => {
                const newIndex = itemsContainer.children.length;
                const newItem = ArrayFieldManager.createArrayItem(
                    fieldName,
                    '',
                    newIndex,
                    placeholder,
                    withFullscreen
                );
                itemsContainer.appendChild(newItem);
            });

            container.appendChild(itemsContainer);
            container.appendChild(addBtn);

            return container;
        },

        createArrayItem: function(fieldName, value, index, placeholder, withFullscreen) {
            const item = document.createElement('div');
            item.className = 'flex gap-2 mb-2 items-start hover:bg-gray-700 rounded-lg p-2 transition-colors';
            item.dataset.index = index;

            const inputType = fieldName === 'tags' ? 'text' : 'textarea';
            let input;

            if (inputType === 'textarea') {
                input = document.createElement('textarea');
                input.className = 'flex-1 px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-400 resize-y font-inherit bg-gray-700 text-gray-200';
                input.style.minHeight = '60px';
                input.rows = 2;
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'flex-1 px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-400 bg-gray-700 text-gray-200';
            }

            input.value = value || '';
            input.placeholder = placeholder;
            input.dataset.fieldName = fieldName;
            input.dataset.index = index;

            input.addEventListener('input', (e) => {
                ArrayFieldManager.updateArrayValue(fieldName, index, e.target.value);
            });

            item.appendChild(input);

            if (withFullscreen) {
                const fullScreenBtn = document.createElement('button');
                fullScreenBtn.className = 'px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 text-sm font-medium whitespace-nowrap transition-colors text-gray-300';
                fullScreenBtn.textContent = 'Full Screen';
                fullScreenBtn.addEventListener('click', () => {
                    const category = fieldName === 'objects' || fieldName === 'positioning' || fieldName === 'text_elements'
                        ? 'visual_details'
                        : fieldName;
                    UIController.openFullScreen(
                        `${fieldName} Item ${index + 1}`,
                        input.value,
                        category,
                        `${fieldName}[${index}]`
                    );
                });
                item.appendChild(fullScreenBtn);
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'px-3 py-2 bg-red-700 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition-colors';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                item.remove();
                ArrayFieldManager.removeArrayItem(fieldName, index);
                ArrayFieldManager.reindexArrayItems(fieldName);
            });

            item.appendChild(removeBtn);

            return item;
        },

        updateArrayValue: function(fieldName, index, value) {
            try {
                const cleanValue = value ? value.trim() : '';

                if (fieldName === 'dialogue') {
                    if (!State.promptData.dialogue) {
                        State.promptData.dialogue = [];
                    }
                    State.promptData.dialogue[index] = cleanValue;
                } else if (fieldName === 'tags') {
                    if (!State.promptData.tags) {
                        State.promptData.tags = [];
                    }
                    State.promptData.tags[index] = cleanValue;
                } else if (State.promptData.visual_details) {
                    if (!State.promptData.visual_details[fieldName]) {
                        State.promptData.visual_details[fieldName] = [];
                    }
                    State.promptData.visual_details[fieldName][index] = cleanValue;
                }

                Debug.log(`Updated array field: ${fieldName}[${index}] = ${cleanValue.substring(0, 30)}...`);
            } catch (error) {
                Debug.error('Error updating array value', error);
            }
        },

        removeArrayItem: function(fieldName, index) {
            if (fieldName === 'dialogue') {
                if (State.promptData.dialogue) {
                    State.promptData.dialogue.splice(index, 1);
                }
            } else if (fieldName === 'tags') {
                if (State.promptData.tags) {
                    State.promptData.tags.splice(index, 1);
                }
            } else if (State.promptData.visual_details && State.promptData.visual_details[fieldName]) {
                State.promptData.visual_details[fieldName].splice(index, 1);
            }
        },

        reindexArrayItems: function(fieldName) {
            const container = document.getElementById(`array-${fieldName}`);
            if (!container) return;

            const items = container.querySelectorAll('.flex.gap-2.mb-2');
            items.forEach((item, newIndex) => {
                item.dataset.index = newIndex;
                const input = item.querySelector('input, textarea');
                if (input) {
                    input.dataset.index = newIndex;
                }
            });

            Debug.log(`Reindexed ${items.length} items for ${fieldName}`);
        },

        getArrayValues: function(fieldName) {
            const container = document.getElementById(`array-${fieldName}`);
            if (!container) {
                Debug.warn(`Array container not found: ${fieldName}`);
                return [];
            }

            const inputs = container.querySelectorAll('input, textarea');
            const values = Array.from(inputs)
                .map(input => input.value.trim())
                .filter(val => val.length > 0);

            Debug.log(`Collected ${values.length} values from ${fieldName}`);
            return values;
        }
    };

    // ============================================================================
    // CATEGORY FIELD RENDERERS
    // ============================================================================
    const CategoryFieldRenderers = {
        'Shot Settings': function(container, categoryData) {
            container.innerHTML = '';

            const motionGroup = createFormGroup();
            const motionLabel = createLabel('Motion Level:');
            const motionRow = createFormRow();
            const motionSelect = createSelect([
                'low',
                'medium',
                'high',
                'custom',
                ...CustomDropdownManager.loadCustomOptions('shot', 'motion_level')
            ], categoryData.motion_level || 'medium');

            motionSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    CustomDropdownManager.convertToCustomInput(e.target, 'shot', 'motion_level');
                } else {
                    State.promptData.shot.motion_level = e.target.value;
                }
            });

            motionRow.appendChild(motionSelect);
            motionGroup.append(motionLabel, motionRow);
            container.appendChild(motionGroup);

            const depthGroup = createFormGroup();
            const depthLabel = createLabel('Camera Depth:');
            const depthRow = createFormRow();
            const depthSelect = createSelect([
                'close up',
                'medium shot',
                'full shot',
                'custom',
                ...CustomDropdownManager.loadCustomOptions('shot', 'camera_depth')
            ], categoryData.camera_depth || 'medium shot');

            depthSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    CustomDropdownManager.convertToCustomInput(e.target, 'shot', 'camera_depth');
                } else {
                    State.promptData.shot.camera_depth = e.target.value;
                }
            });

            depthRow.appendChild(depthSelect);
            depthGroup.append(depthLabel, depthRow);
            container.appendChild(depthGroup);

            const viewGroup = createFormGroup();
            const viewLabel = createLabel('Camera View:');
            const viewRow = createFormRow();
            const viewSelect = createSelect([
                'eye level',
                'high angle',
                'low angle',
                'custom',
                ...CustomDropdownManager.loadCustomOptions('shot', 'camera_view')
            ], categoryData.camera_view || 'eye level');

            viewSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    CustomDropdownManager.convertToCustomInput(e.target, 'shot', 'camera_view');
                } else {
                    State.promptData.shot.camera_view = e.target.value;
                }
            });

            viewRow.appendChild(viewSelect);
            viewGroup.append(viewLabel, viewRow);
            container.appendChild(viewGroup);

            const movementGroup = createFormGroup();
            const movementLabel = createLabel('Camera Movement:');
            const movementRow = createFormRow();
            const movementTextarea = createTextarea(
                categoryData.camera_movement || '',
                'Describe camera movement...'
            );

            movementTextarea.addEventListener('change', (e) => {
                State.promptData.shot.camera_movement = e.target.value;
            });

            const movementFullScreenBtn = createButton('Full Screen', 'bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-300');
            movementFullScreenBtn.addEventListener('click', () => {
                UIController.openFullScreen(
                    'Camera Movement',
                    State.promptData.shot.camera_movement || '',
                    'shot',
                    'camera_movement'
                );
            });

            movementRow.append(movementTextarea, movementFullScreenBtn);
            movementGroup.append(movementLabel, movementRow);
            container.appendChild(movementGroup);

            Debug.log('Rendered Shot Settings fields');
        },

        'Scene Settings': function(container, categoryData) {
            container.innerHTML = '';

            const locationGroup = createFormGroup();
            const locationLabel = createLabel('Location:');
            const locationRow = createFormRow();
            const locationTextarea = createTextarea(
                categoryData.location || '',
                'Describe the location...'
            );

            locationTextarea.addEventListener('change', (e) => {
                State.promptData.scene.location = e.target.value;
            });

            const locationFullScreenBtn = createButton('Full Screen', 'bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-300');
            locationFullScreenBtn.addEventListener('click', () => {
                UIController.openFullScreen(
                    'Location',
                    State.promptData.scene.location || '',
                    'scene',
                    'location'
                );
            });

            locationRow.append(locationTextarea, locationFullScreenBtn);
            locationGroup.append(locationLabel, locationRow);
            container.appendChild(locationGroup);

            const environmentGroup = createFormGroup();
            const environmentLabel = createLabel('Environment:');
            const environmentRow = createFormRow();
            const environmentTextarea = createTextarea(
                categoryData.environment || '',
                'Describe the environment...'
            );

            environmentTextarea.addEventListener('change', (e) => {
                State.promptData.scene.environment = e.target.value;
            });

            const environmentFullScreenBtn = createButton('Full Screen', 'bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-300');
            environmentFullScreenBtn.addEventListener('click', () => {
                UIController.openFullScreen(
                    'Environment',
                    State.promptData.scene.environment || '',
                    'scene',
                    'environment'
                );
            });

            environmentRow.append(environmentTextarea, environmentFullScreenBtn);
            environmentGroup.append(environmentLabel, environmentRow);
            container.appendChild(environmentGroup);

            Debug.log('Rendered Scene Settings fields');
        },

        'Cinematography': function(container, categoryData) {
            container.innerHTML = '';

            const fields = [
                { key: 'lighting', label: 'Lighting' },
                { key: 'style', label: 'Style' },
                { key: 'texture', label: 'Texture' },
                { key: 'depth_of_field', label: 'Depth of Field' }
            ];

            fields.forEach(field => {
                const group = createFormGroup();
                const label = createLabel(`${field.label}:`);
                const row = createFormRow();
                const textarea = createTextarea(
                    categoryData[field.key] || '',
                    `Describe ${field.label.toLowerCase()}...`
                );

                textarea.addEventListener('change', (e) => {
                    State.promptData.cinematography[field.key] = e.target.value;
                });

                const fullScreenBtn = createButton('Full Screen', 'bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-300');
                fullScreenBtn.addEventListener('click', () => {
                    UIController.openFullScreen(
                        field.label,
                        State.promptData.cinematography[field.key] || '',
                        'cinematography',
                        field.key
                    );
                });

                row.append(textarea, fullScreenBtn);
                group.append(label, row);
                container.appendChild(group);
            });

            Debug.log('Rendered Cinematography fields');
        },

        'Visual Details': function(container, categoryData) {
            container.innerHTML = '';

            const objectsGroup = createFormGroup();
            const objectsLabel = createLabel('Objects:');
            const objectsArrayField = ArrayFieldManager.createArrayField(
                'objects',
                categoryData.objects || [],
                'Describe an object...',
                true
            );

            objectsGroup.append(objectsLabel, objectsArrayField);
            container.appendChild(objectsGroup);

            const positioningGroup = createFormGroup();
            const positioningLabel = createLabel('Positioning:');
            const positioningArrayField = ArrayFieldManager.createArrayField(
                'positioning',
                categoryData.positioning || [],
                'Describe positioning...',
                true
            );

            positioningGroup.append(positioningLabel, positioningArrayField);
            container.appendChild(positioningGroup);

            const textElementsGroup = createFormGroup();
            const textElementsLabel = createLabel('Text Elements:');
            const textElementsArrayField = ArrayFieldManager.createArrayField(
                'text_elements',
                categoryData.text_elements || [],
                'Enter text element...',
                true
            );

            textElementsGroup.append(textElementsLabel, textElementsArrayField);
            container.appendChild(textElementsGroup);

            Debug.log('Rendered Visual Details fields with array management');
        },

        'Motion Description': function(container, categoryData) {
            container.innerHTML = '';

            const motionGroup = createFormGroup();
            const motionLabel = createLabel('Motion Description:');
            const motionRow = createFormRow();
            const motionTextarea = createTextarea(
                categoryData || '',
                'Describe the motion sequence...',
                '120px'
            );

            motionTextarea.addEventListener('change', (e) => {
                State.promptData.motion = e.target.value;
            });

            const motionFullScreenBtn = createButton('Full Screen', 'bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-300');
            motionFullScreenBtn.addEventListener('click', () => {
                UIController.openFullScreen(
                    'Motion Description',
                    State.promptData.motion || '',
                    'motion',
                    ''
                );
            });

            motionRow.append(motionTextarea, motionFullScreenBtn);
            motionGroup.append(motionLabel, motionRow);
            container.appendChild(motionGroup);

            Debug.log('Rendered Motion Description fields');
        },

        'Audio Settings': function(container, categoryData) {
            container.innerHTML = '';

            const fields = [
                { key: 'music', label: 'Music' },
                { key: 'ambient', label: 'Ambient Sounds' },
                { key: 'sound_effect', label: 'Sound Effects' },
                { key: 'mix_level', label: 'Mix Level' }
            ];

            fields.forEach(field => {
                const group = createFormGroup();
                const label = createLabel(`${field.label}:`);
                const row = createFormRow();
                const textarea = createTextarea(
                    categoryData[field.key] || '',
                    `Describe ${field.label.toLowerCase()}...`
                );

                textarea.addEventListener('change', (e) => {
                    State.promptData.audio[field.key] = e.target.value;
                });

                const fullScreenBtn = createButton('Full Screen', 'bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-300');
                fullScreenBtn.addEventListener('click', () => {
                    UIController.openFullScreen(
                        field.label,
                        State.promptData.audio[field.key] || '',
                        'audio',
                        field.key
                    );
                });

                row.append(textarea, fullScreenBtn);
                group.append(label, row);
                container.appendChild(group);
            });

            Debug.log('Rendered Audio Settings fields');
        },

        'Dialogue': function(container, categoryData) {
            container.innerHTML = '';

            const dialogueGroup = createFormGroup();
            const dialogueLabel = createLabel('Dialogue Lines:');
            const dialogueArrayField = ArrayFieldManager.createArrayField(
                'dialogue',
                categoryData || [],
                'Enter dialogue line...',
                true
            );

            dialogueGroup.append(dialogueLabel, dialogueArrayField);
            container.appendChild(dialogueGroup);

            Debug.log('Rendered Dialogue fields');
        },

        'Tags': function(container, categoryData) {
            container.innerHTML = '';

            const tagsGroup = createFormGroup();
            const tagsLabel = createLabel('Tags:');
            const tagsArrayField = ArrayFieldManager.createArrayField(
                'tags',
                categoryData || [],
                'Enter a tag...',
                false
            );

            tagsGroup.append(tagsLabel, tagsArrayField);
            container.appendChild(tagsGroup);

            Debug.log('Rendered Tags fields (single-line, no fullscreen)');
        }
    };

    // ============================================================================
    // UI CONTROLLER
    // ============================================================================
    const UIController = {
        expandCategory: function(categoryName) {
            if (State.ui.activeCategory && State.ui.activeCategory !== categoryName) {
                DataIntegrity.collectArrayValuesForCategory(State.ui.activeCategory);
            }

            State.ui.activeCategory = categoryName;
            State.ui.categoryViewMode = 'subarray';
            State.ui.drawerExpanded = true;

            const drawer = document.getElementById('gvp-drawer');
            if (drawer) {
                drawer.classList.remove('w-[420px]');
                drawer.classList.add('w-[525px]');
            }

            document.getElementById('gvp-subarray-title').textContent = categoryName;

            document.getElementById('gvp-category-grid').classList.add('hidden');
            document.getElementById('gvp-subarray-view').classList.remove('hidden');

            const container = document.getElementById('gvp-subarray-container');
            if (container && CategoryFieldRenderers[categoryName]) {
                let categoryData;

                switch (categoryName) {
                    case 'Shot Settings':
                        categoryData = State.promptData.shot;
                        break;
                    case 'Scene Settings':
                        categoryData = State.promptData.scene;
                        break;
                    case 'Cinematography':
                        categoryData = State.promptData.cinematography;
                        break;
                    case 'Visual Details':
                        categoryData = State.promptData.visual_details;
                        break;
                    case 'Motion Description':
                        categoryData = State.promptData.motion;
                        break;
                    case 'Audio Settings':
                        categoryData = State.promptData.audio;
                        break;
                    case 'Dialogue':
                        categoryData = State.promptData.dialogue;
                        break;
                    case 'Tags':
                        categoryData = State.promptData.tags;
                        break;
                    default:
                        categoryData = {};
                }

                CategoryFieldRenderers[categoryName](container, categoryData);
            }

            UIController.toggleBottomBar(true);

            Debug.log(`Expanded to category: ${categoryName}`);
        },

        collapseToGrid: function() {
            if (State.ui.activeCategory) {
                DataIntegrity.collectArrayValuesForCategory(State.ui.activeCategory);
            }

            State.ui.activeCategory = null;
            State.ui.activeSubArray = null;
            State.ui.categoryViewMode = 'grid';
            State.ui.drawerExpanded = false;

            const drawer = document.getElementById('gvp-drawer');
            if (drawer) {
                drawer.classList.remove('w-[525px]');
                drawer.classList.add('w-[420px]');
            }

            document.getElementById('gvp-category-grid').classList.remove('hidden');
            document.getElementById('gvp-subarray-view').classList.add('hidden');

            UIController.toggleBottomBar(true);

            Debug.log('Collapsed to grid view');
        },

        switchTab: function(tabName) {
            if (State.ui.activeCategory && State.activeTab === 'json-editor') {
                DataIntegrity.collectArrayValuesForCategory(State.ui.activeCategory);
            }

            document.querySelectorAll('.gvp-tab').forEach(tab => {
                tab.classList.remove('bg-white', 'text-blue-600', 'border-b-3', 'border-blue-500', 'font-semibold');
                tab.classList.add('text-gray-600');
            });

            const clickedTab = Array.from(document.querySelectorAll('.gvp-tab')).find(tab =>
                tab.textContent.toLowerCase().includes(tabName.toLowerCase().split(' ')[0])
            );
            if (clickedTab) {
                clickedTab.classList.add('bg-white', 'text-blue-600', 'border-b-3', 'border-blue-500', 'font-semibold');
                clickedTab.classList.remove('text-gray-600');
            }

            document.querySelectorAll('.gvp-tab-content').forEach(content => {
                content.classList.remove('block');
                content.classList.add('hidden');
            });

            const tabId = `gvp-${tabName.toLowerCase().replace(/\s+/g, '-')}`;
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.remove('hidden');
                tabContent.classList.add('block');
            }

            State.activeTab = tabName.toLowerCase().replace(/\s+/g, '-');
            Debug.log(`Switched to tab: ${tabName}`);
        },

        toggleDrawer: function() {
            const drawer = document.getElementById('gvp-drawer');
            const backdrop = document.getElementById('gvp-backdrop');

            State.isOpen = !State.isOpen;

            if (State.isOpen) {
                drawer.classList.remove('translate-x-full');
                drawer.classList.add('translate-x-0');
                backdrop.classList.remove('opacity-0', 'invisible');
                backdrop.classList.add('opacity-100', 'visible');
            } else {
                if (State.ui.activeCategory) {
                    DataIntegrity.collectArrayValuesForCategory(State.ui.activeCategory);
                }

                drawer.classList.add('translate-x-full');
                drawer.classList.remove('translate-x-0');
                backdrop.classList.add('opacity-0', 'invisible');
                backdrop.classList.remove('opacity-100', 'visible');
            }

            UIController.toggleBottomBar(State.isOpen);

            Debug.log(`Drawer ${State.isOpen ? 'opened' : 'closed'}`);
        },

        openFullScreen: function(label, currentValue, category, field) {
            const modal = document.getElementById('gvp-fullscreen-modal');
            const title = document.getElementById('gvp-fullscreen-title');
            const textarea = document.getElementById('gvp-fullscreen-textarea');

            State.fullscreenContent = {
                category: category,
                subArray: field,
                value: currentValue || '',
                formattedValue: SentenceFormatter.toDisplay(currentValue || '')
            };

            let titleText = label;
            if (category && field) {
                titleText = `${category} → ${label}`;
            }
            titleText += ' - Full Screen Editor';

            title.textContent = titleText;
            textarea.value = State.fullscreenContent.formattedValue;

            modal.classList.remove('hidden', 'opacity-0', 'scale-95');
            modal.classList.add('block', 'opacity-100', 'scale-100');

            UIController.toggleBottomBar(false);

            updateWordCount(textarea.value);

            Debug.log(`Opened full screen editor for: ${titleText}`);
        },

        saveFullScreen: function() {
            try {
                const textarea = document.getElementById('gvp-fullscreen-textarea');
                if (!textarea) {
                    Debug.error('Full screen textarea not found');
                    return;
                }

                const displayText = textarea.value;
                const storageText = SentenceFormatter.toStorage(displayText);

                const { category, subArray } = State.fullscreenContent;

                if (category && subArray) {
                    if (subArray.includes('[')) {
                        const fieldName = subArray.split('[')[0];
                        const index = parseInt(subArray.match(/\[(\d+)\]/)[1]);

                        if (category === 'visual_details') {
                            if (!State.promptData.visual_details[fieldName]) {
                                State.promptData.visual_details[fieldName] = [];
                            }
                            State.promptData.visual_details[fieldName][index] = storageText;
                        } else if (category === 'dialogue') {
                            if (!State.promptData.dialogue) {
                                State.promptData.dialogue = [];
                            }
                            State.promptData.dialogue[index] = storageText;
                        }
                    } else {
                        if (category === 'motion') {
                            State.promptData.motion = storageText;
                        } else {
                            if (!State.promptData[category]) {
                                State.promptData[category] = {};
                            }
                            State.promptData[category][subArray] = storageText;
                        }
                    }

                    Debug.log(`Saved field: ${category}.${subArray}`);
                }

                if (State.ui.activeCategory) {
                    DataIntegrity.collectArrayValuesForCategory(State.ui.activeCategory);
                }

                UIController.closeFullScreenToGrid();

                Debug.log('Saved full screen content successfully');
            } catch (error) {
                Debug.error('Error saving full screen content', error);
                alert('Error saving content. Check console for details.');
            }
        },

        minimizeFullScreen: function() {
            try {
                const textarea = document.getElementById('gvp-fullscreen-textarea');
                if (!textarea) return;

                const displayText = textarea.value;
                const storageText = SentenceFormatter.toStorage(displayText);

                const { category, subArray } = State.fullscreenContent;

                if (category && subArray) {
                    if (subArray.includes('[')) {
                        const fieldName = subArray.split('[')[0];
                        const index = parseInt(subArray.match(/\[(\d+)\]/)[1]);

                        if (category === 'visual_details') {
                            if (!State.promptData.visual_details[fieldName]) {
                                State.promptData.visual_details[fieldName] = [];
                            }
                            State.promptData.visual_details[fieldName][index] = storageText;
                        } else if (category === 'dialogue') {
                            if (!State.promptData.dialogue) {
                                State.promptData.dialogue = [];
                            }
                            State.promptData.dialogue[index] = storageText;
                        }
                    } else {
                        if (category === 'motion') {
                            State.promptData.motion = storageText;
                        } else {
                            if (!State.promptData[category]) {
                                State.promptData[category] = {};
                            }
                            State.promptData[category][subArray] = storageText;
                        }
                    }
                }

                const modal = document.getElementById('gvp-fullscreen-modal');
                modal.classList.add('hidden', 'opacity-0', 'scale-95');
                modal.classList.remove('block', 'opacity-100', 'scale-100');

                State.ui.categoryViewMode = 'subarray';

                if (State.ui.activeCategory) {
                    const container = document.getElementById('gvp-subarray-container');
                    if (container && CategoryFieldRenderers[State.ui.activeCategory]) {
                        let categoryData;

                        switch (State.ui.activeCategory) {
                            case 'Shot Settings':
                                categoryData = State.promptData.shot;
                                break;
                            case 'Scene Settings':
                                categoryData = State.promptData.scene;
                                break;
                            case 'Cinematography':
                                categoryData = State.promptData.cinematography;
                                break;
                            case 'Visual Details':
                                categoryData = State.promptData.visual_details;
                                break;
                            case 'Motion Description':
                                categoryData = State.promptData.motion;
                                break;
                            case 'Audio Settings':
                                categoryData = State.promptData.audio;
                                break;
                            case 'Dialogue':
                                categoryData = State.promptData.dialogue;
                                break;
                            case 'Tags':
                                categoryData = State.promptData.tags;
                                break;
                            default:
                                categoryData = {};
                        }

                        CategoryFieldRenderers[State.ui.activeCategory](container, categoryData);
                    }
                }

                UIController.toggleBottomBar(true);

                State.fullscreenContent = {
                    category: null,
                    subArray: null,
                    value: '',
                    formattedValue: ''
                };

                Debug.log('Minimized full screen to sub-array view');
            } catch (error) {
                Debug.error('Error minimizing fullscreen', error);
            }
        },

        closeFullScreenToGrid: function() {
            const modal = document.getElementById('gvp-fullscreen-modal');
            modal.classList.add('hidden', 'opacity-0', 'scale-95');
            modal.classList.remove('block', 'opacity-100', 'scale-100');

            UIController.collapseToGrid();

            State.fullscreenContent = {
                category: null,
                subArray: null,
                value: '',
                formattedValue: ''
            };

            Debug.log('Closed full screen to grid view');
        },

        toggleBottomBar: function(show = true) {
            const bottomBar = document.getElementById('gvp-bottom-bar');
            if (!bottomBar) {
                Debug.error('Bottom bar element not found');
                return;
            }

            if (show) {
                bottomBar.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
                bottomBar.classList.add('translate-y-0', 'opacity-100');
                if (State.ui.drawerExpanded) {
                    bottomBar.classList.remove('w-[420px]');
                    bottomBar.classList.add('w-[525px]');
                } else {
                    bottomBar.classList.remove('w-[525px]');
                    bottomBar.classList.add('w-[420px]');
                }
                Debug.log('Bottom bar shown');
            } else {
                bottomBar.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
                bottomBar.classList.remove('translate-y-0', 'opacity-100');
                Debug.log('Bottom bar hidden');
            }
        },

        showViewJsonModal: function() {
            try {
                DataIntegrity.collectAllArrays();

                const modal = document.getElementById('gvp-view-json-modal');
                const textarea = document.getElementById('gvp-view-json-textarea');

                if (!modal || !textarea) {
                    Debug.error('View JSON modal elements not found');
                    return;
                }

                const displayData = JSON.parse(JSON.stringify(State.promptData));

                Object.keys(displayData).forEach(key => {
                    if (Array.isArray(displayData[key]) && displayData[key].length === 0) {
                        delete displayData[key];
                    } else if (typeof displayData[key] === 'object' && displayData[key] !== null) {
                        Object.keys(displayData[key]).forEach(subKey => {
                            if (Array.isArray(displayData[key][subKey]) && displayData[key][subKey].length === 0) {
                                delete displayData[key][subKey];
                            }
                        });
                        if (Object.keys(displayData[key]).length === 0) {
                            delete displayData[key];
                        }
                    }
                });

                textarea.value = JSON.stringify(displayData, null, 2);
                modal.classList.remove('hidden');
                modal.classList.add('flex');

                Debug.log('Opened View JSON modal');
            } catch (error) {
                Debug.error('Error showing View JSON modal', error);
                alert('Error displaying JSON data. Check console for details.');
            }
        },

        hideViewJsonModal: function() {
            const modal = document.getElementById('gvp-view-json-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            Debug.log('Closed View JSON modal');
        }
    };

    // ============================================================================
    // DATA MANAGER
    // ============================================================================
    const DataManager = {
        initPromptData: function() {
            State.promptData = {
                shot: {
                    motion_level: 'medium',
                    camera_depth: 'medium shot',
                    camera_view: 'eye level',
                    camera_movement: 'slight, smooth side-to-side pan following the subjects\' movement'
                },
                scene: {
                    location: 'sandy beach by the ocean',
                    environment: 'Object containing a descriptive string outlining the setting, including background elements and atmospheric conditions.'
                },
                cinematography: {
                    lighting: 'natural daylight',
                    style: 'realistic',
                    texture: 'Object with a descriptive string detailing the visual textures of key elements in the scene.',
                    depth_of_field: 'String describing the focus technique, specifying foreground sharpness and background blur.'
                },
                visual_details: {
                    objects: [
                        'Array of strings, each providing a detailed description of an individual subject\'s appearance, attire, and expression.',
                        'Array of strings, each providing a detailed description of an individual subject\'s appearance, attire, and expression.',
                        'Array of strings, each providing a detailed description of an individual subject\'s appearance, attire, and expression.'
                    ],
                    positioning: [
                        'Array of strings describing the spatial arrangement and orientation of subjects relative to each other and the camera.'
                    ],
                    text_elements: []
                },
                motion: 'String containing a comprehensive, sequential narrative of all movements, interactions, and environmental dynamics throughout the video sequence.',
                audio: {
                    music: 'String describing the style, mood, and instrumental components of the background track.',
                    ambient: 'String outlining natural environmental sounds present in the scene.',
                    sound_effect: 'String detailing character-generated or action-specific audio cues.',
                    mix_level: 'String explaining the balance and integration of audio layers for immersion.'
                },
                dialogue: [],
                tags: [
                    'Array of strings representing key thematic or categorical labels for the video content.'
                ]
            };

            Debug.log('Initialized promptData with Video.json placeholder strings');
        },

        getEmptyPromptData: function() {
            return {
                shot: { motion_level: '', camera_depth: '', camera_view: '', camera_movement: '' },
                scene: { location: '', environment: '' },
                cinematography: { lighting: '', style: '', texture: '', depth_of_field: '' },
                visual_details: { objects: [], positioning: [], text_elements: [] },
                motion: '',
                audio: { music: '', ambient: '', sound_effect: '', mix_level: '' },
                dialogue: [],
                tags: []
            };
        }
    };

    // ============================================================================
    // NETWORK INTERCEPTOR
    // ============================================================================
    const NetworkInterceptor = {
        _processStream: async function(stream) {
            try {
                const reader = stream.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    let braceCount = 0, jsonStart = -1, lastProcessedIndex = 0;

                    for (let i = 0; i < buffer.length; i++) {
                        if (buffer[i] === '{') {
                            if (braceCount === 0) jsonStart = i;
                            braceCount++;
                        } else if (buffer[i] === '}') {
                            if (braceCount > 0) braceCount--;
                            if (braceCount === 0 && jsonStart !== -1) {
                                const jsonString = buffer.substring(jsonStart, i + 1);
                                lastProcessedIndex = i + 1;
                                jsonStart = -1;

                                try {
                                    const data = JSON.parse(jsonString);
                                    const videoResponse = data?.result?.response?.streamingVideoGenerationResponse;

                                    if (videoResponse && videoResponse.progress === 100 && videoResponse.videoPrompt) {
                                        Debug.log('Generation complete. Found final videoPrompt.');
                                        const newPromptData = JSON.parse(videoResponse.videoPrompt);
                                        State.promptData = { ...DataManager.getEmptyPromptData(), ...newPromptData };
                                        Debug.info('Successfully updated State.promptData with grabbed JSON.');
                                        SoundNotifications.playSuccess();
                                    }
                                } catch (e) {
                                    // Ignore non-fatal parsing errors
                                }
                            }
                        }
                    }

                    if (lastProcessedIndex > 0) {
                        buffer = buffer.substring(lastProcessedIndex);
                    }
                }
            } catch (error) {
                Debug.error('Error processing network stream.', error);
            }
        },

        init: function() {
            const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

            if (typeof w.fetch !== 'function') {
                Debug.warn('Target fetch function is not available. Network interception disabled.');
                return;
            }

            const originalFetch = w.fetch;
            const self = this;

            w.fetch = async function(...args) {
                const response = await originalFetch.apply(w, args);

                const [url, options] = args;

                if (typeof url === 'string' && url.includes('/rest/app-chat/conversations/new') && options?.method === 'POST') {
                    Debug.log('Intercepted video generation response stream.', { url });
                    if (response && typeof response.clone === 'function') {
                        self._processStream(response.clone().body);
                    }
                }

                return response;
            };

            Debug.log('Network interceptor initialized with chained fetch override for compatibility.');
        }
    };

    // ============================================================================
    // SOUND NOTIFICATIONS
    // ============================================================================
    const SoundNotifications = {
        playSuccess: () => {
            if (!State.settings.soundEnabled) return;

            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 800;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);

                Debug.log('Played success sound');
            } catch (error) {
                Debug.error('Error playing sound', error);
            }
        }
    };

    // ============================================================================
    // HISTORY MANAGER
    // ============================================================================
    const HistoryManager = {
        addGeneration: (prompt, status, mode) => {
            const generation = {
                id: `gen_${Date.now()}`,
                timestamp: Date.now(),
                prompt: prompt,
                status: status,
                duration: 0,
                mode: mode,
                videoUrl: null,
                error: null,
                promptType: State.activeTab === 'json-editor' ? 'json' : 'raw'
            };

            State.history.data.unshift(generation);
            Storage.save('gvp-history', State.history.data);

            Debug.log('Added generation to history:', generation.id);
        }
    };

    // ============================================================================
    // STATISTICS MANAGER
    // ============================================================================
    const StatisticsManager = {
        calculateStats: () => {
            Debug.log('Statistics calculated');
        },

        updateDisplay: () => {
            Debug.log('Statistics display updated');
        }
    };

    // ============================================================================
    // SETTINGS MANAGER
    // ============================================================================
    const SettingsManager = {
        saveSettings: () => {
            Storage.save('gvp-settings', State.settings);
            Debug.log('Settings saved');
        }
    };

    // ============================================================================
    // DEBUG MANAGER
    // ============================================================================
    const DebugManager = {
        logMessage: (level, message, data) => {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = {
                timestamp: timestamp,
                level: level,
                message: message,
                data: data,
                id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };

            const debugLogContainer = document.getElementById('gvp-debug-log');
            if (!debugLogContainer) return;

            const logEntryDiv = document.createElement('div');
            logEntryDiv.id = logEntry.id;

            const colorMap = {
                'debug': '#888',
                'info': '#0f0',
                'warn': '#ff0',
                'error': '#f00'
            };

            logEntryDiv.style.color = colorMap[level] || '#0f0';

            const messageText = data ?
                `${timestamp} [${level.toUpperCase()}] ${message}` :
                `${timestamp} [${level.toUpperCase()}] ${message}`;

            logEntryDiv.textContent = messageText;

            debugLogContainer.appendChild(logEntryDiv);
            debugLogContainer.scrollTop = debugLogContainer.scrollHeight;

            while (debugLogContainer.children.length > 1000) {
                debugLogContainer.removeChild(debugLogContainer.firstChild);
            }
        }
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    const updateWordCount = (text) => {
        const wordCount = document.querySelector('#gvp-fullscreen-footer span');
        if (wordCount) {
            const words = text.split(/\s+/).filter(word => word.length > 0).length;
            wordCount.textContent = `${words} words`;
        }
    };

    // ============================================================================
    // GENERATION FUNCTIONS
    // ============================================================================
    window.generateVideo = function() {
        DataIntegrity.collectAllArrays();

        const promptJson = JSON.stringify(State.promptData);

        const grokTextarea = document.querySelector('textarea[aria-label="Make a video"]');
        if (!grokTextarea) {
            alert('GVP Error: Could not find Grok\'s input textarea. The interface may have changed.');
            Debug.error('Failed to find Grok textarea with selector: textarea[aria-label="Make a video"]');
            return;
        }

        grokTextarea.value = promptJson;
        grokTextarea.dispatchEvent(new Event('input', { bubbles: true }));

        const sendButton = document.querySelector('button[aria-label="Make video"]');
        if (!sendButton) {
            alert('GVP Error: Could not find Grok\'s send button. The interface may have changed.');
            Debug.error('Failed to find Grok send button with selector: button[aria-label="Make video"]');
            return;
        }

        sendButton.click();

        HistoryManager.addGeneration(promptJson, 'pending', State.settings.defaultMode);

        if (State.settings.autoMinimize) {
            UIController.toggleDrawer();
        }

        Debug.log('Sent JSON prompt to Grok using updated selectors.');
    };

    window.generateRawPrompt = function() {
        DataIntegrity.collectAllArrays();

        let promptText = 'Video Generation Prompt:\n\n';

        if (State.promptData.shot) {
            promptText += `Shot Settings:\n`;
            if (State.promptData.shot.motion_level) promptText += `- Motion Level: ${State.promptData.shot.motion_level}\n`;
            if (State.promptData.shot.camera_depth) promptText += `- Camera Depth: ${State.promptData.shot.camera_depth}\n`;
            if (State.promptData.shot.camera_view) promptText += `- Camera View: ${State.promptData.shot.camera_view}\n`;
            if (State.promptData.shot.camera_movement) promptText += `- Camera Movement: ${State.promptData.shot.camera_movement}\n`;
            promptText += '\n';
        }

        if (State.promptData.scene) {
            promptText += `Scene Settings:\n`;
            if (State.promptData.scene.location) promptText += `- Location: ${State.promptData.scene.location}\n`;
            if (State.promptData.scene.environment) promptText += `- Environment: ${State.promptData.scene.environment}\n`;
            promptText += '\n';
        }

        if (State.promptData.visual_details) {
            promptText += `Visual Details:\n`;
            if (State.promptData.visual_details.objects?.length > 0) {
                promptText += `- Objects: ${State.promptData.visual_details.objects.join(', ')}\n`;
            }
            if (State.promptData.visual_details.positioning?.length > 0) {
                promptText += `- Positioning: ${State.promptData.visual_details.positioning.join(', ')}\n`;
            }
            promptText += '\n';
        }

        if (State.promptData.motion) {
            promptText += `Motion Description:\n${State.promptData.motion}\n\n`;
        }

        if (State.promptData.audio) {
            promptText += `Audio Settings:\n`;
            if (State.promptData.audio.music) promptText += `- Music: ${State.promptData.audio.music}\n`;
            if (State.promptData.audio.ambient) promptText += `- Ambient: ${State.promptData.audio.ambient}\n`;
            promptText += '\n';
        }

        if (State.promptData.tags?.length > 0) {
            promptText += `Tags: ${State.promptData.tags.join(', ')}\n`;
        }

        const grokTextarea = document.querySelector('textarea[placeholder*="Ask anything"], textarea[aria-label*="Message"]');
        if (!grokTextarea) {
            alert('Could not find Grok\'s input field');
            return;
        }

        grokTextarea.value = promptText;
        grokTextarea.dispatchEvent(new Event('input', { bubbles: true }));

        const sendButtons = [
            'button[aria-label*="Send"]',
            'button[data-testid="send-button"]',
            'div[role="button"]:has(svg[data-icon="arrow-up"])',
            'button:has(svg[data-icon="arrow-up"])'
        ];

        let sendButton = null;
        for (const selector of sendButtons) {
            sendButton = document.querySelector(selector);
            if (sendButton) break;
        }

        if (!sendButton) {
            alert('Could not find Grok\'s send button');
            return;
        }

        sendButton.click();

        HistoryManager.addGeneration(promptText, 'pending', State.settings.defaultMode);

        if (State.settings.autoMinimize) {
            UIController.toggleDrawer();
        }

        Debug.log('Sent raw prompt to Grok');
    };

    window.toggleSpicyMode = function() {
        const spicyBtn = document.querySelector('.gvp-spicy-mode-btn');
        const isCurrentlySpicy = State.settings.defaultMode === 'spicy';

        if (isCurrentlySpicy) {
            State.settings.defaultMode = 'normal';
            if (spicyBtn) {
                spicyBtn.classList.remove('bg-red-700');
                spicyBtn.classList.add('bg-gradient-to-r', 'from-orange-500', 'to-orange-600');
            }
        } else {
            State.settings.defaultMode = 'spicy';
            if (spicyBtn) {
                spicyBtn.classList.add('bg-red-700');
                spicyBtn.classList.remove('bg-gradient-to-r', 'from-orange-500', 'to-orange-600');
            }
        }

        SettingsManager.saveSettings();
        Debug.log(`Toggled spicy mode: ${State.settings.defaultMode}`);
    };

    window.exportJSON = function() {
        DataIntegrity.collectAllArrays();

        const blob = new Blob([JSON.stringify(State.promptData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grok-video-prompt-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        Debug.log('Exported JSON prompt');
    };

    // ============================================================================
    // UI CREATION
    // ============================================================================
    const createUI = () => {
        // Floating Button
        const floatingBtn = document.createElement('button');
        floatingBtn.id = 'gvp-floating-btn';
        floatingBtn.className = 'fixed bottom-6 left-4 w-14 h-14 rounded-full bg-gradient-to-br from-gray-900 to-gray-950 border-2 border-amber-400 text-white text-xl cursor-pointer z-[10000] shadow-2xl transition-all duration-200 hover:scale-105 hover:-translate-y-1 active:scale-95 flex items-center justify-center';
        floatingBtn.innerHTML = '🎬';
        document.body.appendChild(floatingBtn);

        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'gvp-backdrop';
        backdrop.className = 'fixed top-0 left-0 w-screen h-screen bg-black/50 z-[10000] opacity-0 invisible transition-all duration-200';
        document.body.appendChild(backdrop);

        // Main Drawer
        const drawer = document.createElement('div');
        drawer.id = 'gvp-drawer';
        drawer.className = 'fixed top-0 right-0 w-[420px] h-screen bg-gray-900 border-l-4 border-amber-400 z-[10001] translate-x-full transition-all duration-300 shadow-2xl overflow-hidden';

        // Header
        const header = document.createElement('div');
        header.id = 'gvp-header';
        header.className = 'h-[60px] bg-gray-950 text-white flex items-center justify-between px-4 border-b-2 border-amber-400';

        const title = document.createElement('div');
        title.id = 'gvp-title';
        title.className = 'font-semibold text-lg tracking-tight';
        title.textContent = 'Grok Video Prompter v10.0.2.0';

        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'bg-white/10 border border-white/20 text-white text-lg cursor-pointer px-2 py-1 rounded-lg transition-all hover:bg-white/20 hover:scale-105 w-8 h-8 flex items-center justify-center';
        minimizeBtn.innerHTML = '−';
        minimizeBtn.title = 'Minimize';

        header.appendChild(title);
        header.appendChild(minimizeBtn);

        // Tab Navigation
        const tabs = document.createElement('div');
        tabs.id = 'gvp-tabs';
        tabs.className = 'flex bg-black/50 border-b border-gray-700 overflow-x-auto scrollbar-thin';

        const tabNames = ['JSON Editor', 'Raw Input', 'History', 'Statistics', 'Settings', 'Debug'];
        tabNames.forEach((name, index) => {
            const tab = document.createElement('button');
            tab.className = `flex-1 min-w-[100px] px-4 py-2 text-center bg-transparent border-none cursor-pointer text-sm font-medium text-gray-400 border-b-3 border-transparent transition-all hover:bg-gray-800 hover:text-gray-300 ${index === 0 ? 'bg-gray-800 text-amber-400 border-amber-400 font-semibold' : ''}`;
            tab.classList.add('gvp-tab');
            tab.textContent = name;
            tabs.appendChild(tab);
        });

        // Tab Content Container
        const tabContent = document.createElement('div');
        tabContent.id = 'gvp-tab-content';
        tabContent.className = 'bg-gray-900';

        // JSON Editor Tab
        const jsonEditorTab = document.createElement('div');
        jsonEditorTab.className = 'gvp-tab-content block h-[calc(100vh-120px)] overflow-hidden bg-gray-900';
        jsonEditorTab.id = 'gvp-json-editor';

        // Category Grid
        const categoryGrid = document.createElement('div');
        categoryGrid.id = 'gvp-category-grid';
        categoryGrid.className = 'grid grid-cols-2 gap-4 p-4 h-full overflow-auto bg-gray-900';

        const categories = [
            'Shot Settings',
            'Scene Settings',
            'Cinematography',
            'Visual Details',
            'Motion Description',
            'Audio Settings',
            'Dialogue',
            'Tags'
        ];

        categories.forEach(category => {
            const card = document.createElement('div');
            card.className = 'aspect-square bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center cursor-pointer transition-all text-sm font-semibold text-center p-4 text-gray-300 shadow-md hover:bg-gray-700/50 hover:border-amber-400 hover:-translate-y-1 hover:shadow-xl active:-translate-y-0.5';
            card.textContent = category;
            categoryGrid.appendChild(card);
        });

        jsonEditorTab.appendChild(categoryGrid);

        // Sub-Array View
        const subArrayView = document.createElement('div');
        subArrayView.id = 'gvp-subarray-view';
        subArrayView.className = 'hidden h-full flex flex-col bg-gray-900 transition-all duration-300';

        const subArrayHeader = document.createElement('div');
        subArrayHeader.id = 'gvp-subarray-header';
        subArrayHeader.className = 'flex items-center gap-2 px-4 py-4 border-b border-gray-700 bg-gray-900 min-h-[60px]';

        const subArrayTitle = document.createElement('div');
        subArrayTitle.id = 'gvp-subarray-title';
        subArrayTitle.className = 'text-base font-semibold flex-1 text-gray-300';

        const subArrayBackBtn = document.createElement('button');
        subArrayBackBtn.id = 'gvp-subarray-back-btn';
        subArrayBackBtn.className = 'bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1 rounded-lg cursor-pointer text-xs font-medium transition-all hover:bg-gray-700 hover:border-amber-400 hover:text-amber-400';
        subArrayBackBtn.textContent = '← Back';

        subArrayHeader.appendChild(subArrayTitle);
        subArrayHeader.appendChild(subArrayBackBtn);

        const subArrayContainer = document.createElement('div');
        subArrayContainer.id = 'gvp-subarray-container';
        subArrayContainer.className = 'flex-1 p-4 overflow-auto h-[calc(100vh-180px)] bg-gray-900';

        subArrayView.appendChild(subArrayHeader);
        subArrayView.appendChild(subArrayContainer);

        jsonEditorTab.appendChild(subArrayView);

        // Other tabs (simplified placeholders)
        const rawInputTab = document.createElement('div');
        rawInputTab.className = 'gvp-tab-content hidden';
        rawInputTab.id = 'gvp-raw-input';
        rawInputTab.innerHTML = '<div class="p-4 bg-gray-900 h-full"><h3 class="text-lg font-semibold mb-2 text-gray-300">Raw Input Tab</h3><p class="text-gray-500">Not implemented in this version</p></div>';

        const historyTab = document.createElement('div');
        historyTab.className = 'gvp-tab-content hidden';
        historyTab.id = 'gvp-history';
        historyTab.innerHTML = '<div class="p-4 bg-gray-900 h-full"><h3 class="text-lg font-semibold mb-2 text-gray-300">History Tab</h3><p class="text-gray-500">Not implemented in this version</p></div>';

        const statsTab = document.createElement('div');
        statsTab.className = 'gvp-tab-content hidden';
        statsTab.id = 'gvp-statistics';
        statsTab.innerHTML = '<div class="p-4 bg-gray-900 h-full"><h3 class="text-lg font-semibold mb-2 text-gray-300">Statistics Tab</h3><p class="text-gray-500">Not implemented in this version</p></div>';

        const settingsTab = document.createElement('div');
        settingsTab.className = 'gvp-tab-content hidden';
        settingsTab.id = 'gvp-settings';
        settingsTab.innerHTML = '<div class="p-4 bg-gray-900 h-full"><h3 class="text-lg font-semibold mb-2 text-gray-300">Settings Tab</h3><p class="text-gray-500">Not implemented in this version</p></div>';

        const debugTab = document.createElement('div');
        debugTab.className = 'gvp-tab-content hidden';
        debugTab.id = 'gvp-debug';

        const debugContainer = document.createElement('div');
        debugContainer.className = 'p-4 h-full flex flex-col';

        const debugLog = document.createElement('div');
        debugLog.id = 'gvp-debug-log';
        debugLog.className = 'flex-1 overflow-auto bg-gray-950 text-green-400 font-mono text-xs p-2 rounded-lg border border-amber-400 leading-relaxed';

        debugContainer.appendChild(debugLog);
        debugTab.appendChild(debugContainer);

        // Fullscreen Modal
        const fullscreenModal = document.createElement('div');
        fullscreenModal.id = 'gvp-fullscreen-modal';
        fullscreenModal.className = 'fixed top-0 left-0 w-screen h-screen bg-gray-900 z-[10003] hidden opacity-0 scale-95 transition-all duration-300';

        const fullscreenHeader = document.createElement('div');
        fullscreenHeader.id = 'gvp-fullscreen-header';
        fullscreenHeader.className = 'h-[60px] bg-gray-950 text-white flex items-center justify-between px-4 border-b-2 border-amber-400';

        const fullscreenTitle = document.createElement('div');
        fullscreenTitle.id = 'gvp-fullscreen-title';
        fullscreenTitle.className = 'font-semibold text-base';
        fullscreenTitle.textContent = 'Full Screen Editor';

        const fullscreenMinimizeBtn = document.createElement('button');
        fullscreenMinimizeBtn.className = 'bg-white/10 border border-white/20 text-white text-lg cursor-pointer px-2 py-1 rounded-lg transition-all hover:bg-white/20 hover:scale-105 w-8 h-8 flex items-center justify-center';
        fullscreenMinimizeBtn.innerHTML = '−';
        fullscreenMinimizeBtn.title = 'Minimize to Category View';

        const fullscreenCloseBtn = document.createElement('button');
        fullscreenCloseBtn.className = 'bg-white/10 border border-white/20 text-white text-lg cursor-pointer px-2 py-1 rounded-lg transition-all hover:bg-white/20 hover:scale-105 w-8 h-8 flex items-center justify-center ml-2';
        fullscreenCloseBtn.innerHTML = '×';
        fullscreenCloseBtn.title = 'Close Full Screen';

        fullscreenHeader.appendChild(fullscreenTitle);
        fullscreenHeader.appendChild(fullscreenMinimizeBtn);
        fullscreenHeader.appendChild(fullscreenCloseBtn);

        const fullscreenContent = document.createElement('div');
        fullscreenContent.id = 'gvp-fullscreen-content';
        fullscreenContent.className = 'h-[calc(100vh-120px)] p-4 overflow-auto';

        const fullscreenTextarea = document.createElement('textarea');
        fullscreenTextarea.id = 'gvp-fullscreen-textarea';
        fullscreenTextarea.className = 'w-[calc(100vw-32px)] h-[calc(100vh-180px)] border border-gray-700 rounded-lg p-4 text-sm leading-relaxed resize-none bg-gray-800 text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400';
        fullscreenTextarea.placeholder = 'Enter your text here...';

        fullscreenContent.appendChild(fullscreenTextarea);

        const fullscreenFooter = document.createElement('div');
        fullscreenFooter.id = 'gvp-fullscreen-footer';
        fullscreenFooter.className = 'h-[60px] bg-gray-800 flex items-center justify-between px-4 border-t border-gray-700';

        const fullscreenSaveBtn = document.createElement('button');
        fullscreenSaveBtn.className = 'px-4 py-2 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md';
        fullscreenSaveBtn.textContent = 'Save & Close';

        const fullscreenCancelBtn = document.createElement('button');
        fullscreenCancelBtn.className = 'px-4 py-2 bg-gray-700 border border-gray-600 text-gray-300 rounded-lg font-semibold transition-all hover:bg-gray-600';
        fullscreenCancelBtn.textContent = 'Cancel';

        const wordCount = document.createElement('span');
        wordCount.className = 'text-xs text-gray-400 ml-auto';
        wordCount.textContent = '0 words';

        fullscreenFooter.appendChild(fullscreenSaveBtn);
        fullscreenFooter.appendChild(fullscreenCancelBtn);
        fullscreenFooter.appendChild(wordCount);

        fullscreenModal.appendChild(fullscreenHeader);
        fullscreenModal.appendChild(fullscreenContent);
        fullscreenModal.appendChild(fullscreenFooter);

        // Bottom Bar
        const bottomBar = document.createElement('div');
        bottomBar.id = 'gvp-bottom-bar';
        bottomBar.className = 'fixed bottom-0 right-0 w-[420px] h-20 bg-gradient-to-r from-gray-950 to-gray-900 border-t-2 border-amber-400 flex flex-col z-[10002] translate-y-full opacity-0 pointer-events-none transition-all duration-300';

        const topRow = document.createElement('div');
        topRow.className = 'flex items-center justify-center py-1 px-4 flex-1';

        const viewJsonBtn = document.createElement('button');
        viewJsonBtn.className = 'bg-white/10 border border-white/20 text-white px-2 py-1 rounded-lg cursor-pointer text-xs font-medium transition-all hover:bg-white/20 hover:scale-105 flex items-center gap-1';
        viewJsonBtn.innerHTML = '👁️ View Current JSON';

        topRow.appendChild(viewJsonBtn);

        const bottomRow = document.createElement('div');
        bottomRow.className = 'flex items-center justify-between py-1 px-4 flex-1';

        const leftSection = document.createElement('div');
        leftSection.className = 'flex items-center gap-2';

        const generateJsonBtn = document.createElement('button');
        generateJsonBtn.className = 'gvp-generate-json-btn bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white border-none shadow-sm px-3 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-md flex items-center gap-1';
        generateJsonBtn.innerHTML = '📄 Generate JSON';

        const generateRawBtn = document.createElement('button');
        generateRawBtn.className = 'gvp-generate-raw-btn bg-gray-600 hover:bg-gray-500 text-white border-none shadow-sm px-3 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-md flex items-center gap-1';
        generateRawBtn.innerHTML = '📝 Generate Raw';

        leftSection.appendChild(generateJsonBtn);
        leftSection.appendChild(generateRawBtn);

        const rightSection = document.createElement('div');
        rightSection.className = 'flex items-center gap-2';

        const spicyModeBtn = document.createElement('button');
        spicyModeBtn.className = 'gvp-spicy-mode-btn bg-gradient-to-r from-orange-500 to-orange-600 text-white border-none shadow-sm px-3 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-md flex items-center gap-1';
        spicyModeBtn.innerHTML = '🌶️ Spicy Mode';

        rightSection.appendChild(spicyModeBtn);

        bottomRow.appendChild(leftSection);
        bottomRow.appendChild(rightSection);

        bottomBar.appendChild(topRow);
        bottomBar.appendChild(bottomRow);

        // View JSON Modal
        const viewJsonModal = document.createElement('div');
        viewJsonModal.id = 'gvp-view-json-modal';
        viewJsonModal.className = 'fixed top-0 left-0 w-screen h-screen bg-black/80 z-[10003] hidden items-center justify-center p-6';

        const viewJsonContent = document.createElement('div');
        viewJsonContent.id = 'gvp-view-json-content';
        viewJsonContent.className = 'bg-gray-900 rounded-lg p-6 max-w-3xl max-h-[80vh] w-full shadow-2xl relative border border-gray-700';

        const viewJsonHeader = document.createElement('div');
        viewJsonHeader.id = 'gvp-view-json-header';
        viewJsonHeader.className = 'flex items-center justify-between mb-4 pb-4 border-b border-gray-700';

        const viewJsonTitle = document.createElement('div');
        viewJsonTitle.id = 'gvp-view-json-title';
        viewJsonTitle.className = 'text-lg font-semibold text-gray-300';
        viewJsonTitle.textContent = 'Current Prompt Data (JSON)';

        const viewJsonClose = document.createElement('button');
        viewJsonClose.id = 'gvp-view-json-close';
        viewJsonClose.className = 'bg-gray-800 border border-gray-700 text-gray-400 w-8 h-8 rounded-full cursor-pointer text-base flex items-center justify-center transition-all hover:bg-red-700 hover:border-red-600 hover:text-white';
        viewJsonClose.innerHTML = '×';

        viewJsonHeader.appendChild(viewJsonTitle);
        viewJsonHeader.appendChild(viewJsonClose);

        const viewJsonBody = document.createElement('div');
        viewJsonBody.id = 'gvp-view-json-body';
        viewJsonBody.className = 'max-h-[calc(80vh-200px)] overflow-auto';

        const viewJsonTextarea = document.createElement('textarea');
        viewJsonTextarea.id = 'gvp-view-json-textarea';
        viewJsonTextarea.className = 'w-full h-96 border border-gray-700 rounded-lg p-4 text-xs leading-relaxed resize-y bg-gray-800 text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400';
        viewJsonTextarea.readOnly = true;

        viewJsonBody.appendChild(viewJsonTextarea);

        const viewJsonFooter = document.createElement('div');
        viewJsonFooter.id = 'gvp-view-json-footer';
        viewJsonFooter.className = 'mt-4 pt-4 border-t border-gray-700 flex items-center justify-between';

        const viewJsonCopy = document.createElement('button');
        viewJsonCopy.className = 'px-4 py-2 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md';
        viewJsonCopy.textContent = 'Copy JSON';

        const viewJsonExport = document.createElement('button');
        viewJsonExport.className = 'px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md';
        viewJsonExport.textContent = 'Export JSON';

        viewJsonFooter.appendChild(viewJsonCopy);
        viewJsonFooter.appendChild(viewJsonExport);

        viewJsonContent.appendChild(viewJsonHeader);
        viewJsonContent.appendChild(viewJsonBody);
        viewJsonContent.appendChild(viewJsonFooter);
        viewJsonModal.appendChild(viewJsonContent);

        // Assemble Structure
        drawer.appendChild(header);
        drawer.appendChild(tabs);

        tabContent.appendChild(jsonEditorTab);
        tabContent.appendChild(rawInputTab);
        tabContent.appendChild(historyTab);
        tabContent.appendChild(statsTab);
        tabContent.appendChild(settingsTab);
        tabContent.appendChild(debugTab);

        drawer.appendChild(tabContent);

        document.body.appendChild(drawer);
        document.body.appendChild(fullscreenModal);
        document.body.appendChild(bottomBar);
        document.body.appendChild(viewJsonModal);

        Debug.log('UI created with Tailwind classes');

        return {
            drawer,
            floatingBtn,
            backdrop,
            fullscreenModal,
            bottomBar,
            viewJsonModal
        };
    };

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================
    const attachEventListeners = () => {
        const floatingBtn = document.getElementById('gvp-floating-btn');
        if (floatingBtn) {
            floatingBtn.addEventListener('click', UIController.toggleDrawer);
        }

        const backdrop = document.getElementById('gvp-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', UIController.toggleDrawer);
        }

        const minimizeBtn = document.querySelector('#gvp-header button');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                if (State.ui.categoryViewMode === 'subarray') {
                    UIController.collapseToGrid();
                }

                if (State.ui.activeCategory) {
                    DataIntegrity.collectArrayValuesForCategory(State.ui.activeCategory);
                }
                UIController.toggleDrawer();
            });
        }

        const tabs = document.querySelectorAll('.gvp-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (State.ui.activeCategory && State.activeTab === 'json-editor') {
                    DataIntegrity.collectArrayValuesForCategory(State.ui.activeCategory);
                }
                UIController.switchTab(e.target.textContent);
            });
        });

        const categoryCards = document.querySelectorAll('#gvp-category-grid > div');
        categoryCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const categoryName = e.target.textContent.trim();
                UIController.expandCategory(categoryName);
            });
        });

        const subArrayBackBtn = document.getElementById('gvp-subarray-back-btn');
        if (subArrayBackBtn) {
            subArrayBackBtn.addEventListener('click', () => {
                UIController.collapseToGrid();
            });
        }

        const fullscreenMinimizeBtn = document.querySelector('#gvp-fullscreen-modal button:nth-of-type(1)');
        const fullscreenCloseBtn = document.querySelector('#gvp-fullscreen-modal button:nth-of-type(2)');
        if (fullscreenMinimizeBtn) {
            fullscreenMinimizeBtn.addEventListener('click', UIController.minimizeFullScreen);
        }
        if (fullscreenCloseBtn) {
            fullscreenCloseBtn.addEventListener('click', UIController.closeFullScreenToGrid);
        }

        const fullscreenSaveBtn = document.querySelector('#gvp-fullscreen-footer button:nth-of-type(1)');
        const fullscreenCancelBtn = document.querySelector('#gvp-fullscreen-footer button:nth-of-type(2)');
        if (fullscreenSaveBtn) {
            fullscreenSaveBtn.addEventListener('click', UIController.saveFullScreen);
        }
        if (fullscreenCancelBtn) {
            fullscreenCancelBtn.addEventListener('click', UIController.closeFullScreenToGrid);
        }

        const fullscreenTextarea = document.getElementById('gvp-fullscreen-textarea');
        if (fullscreenTextarea) {
            fullscreenTextarea.addEventListener('input', (e) => {
                updateWordCount(e.target.value);
            });
        }

        const generateJsonBtn = document.querySelector('.gvp-generate-json-btn');
        if (generateJsonBtn) {
            generateJsonBtn.addEventListener('click', generateVideo);
        }

        const generateRawBtn = document.querySelector('.gvp-generate-raw-btn');
        if (generateRawBtn) {
            generateRawBtn.addEventListener('click', generateRawPrompt);
        }

        const spicyModeBtn = document.querySelector('.gvp-spicy-mode-btn');
        if (spicyModeBtn) {
            spicyModeBtn.addEventListener('click', toggleSpicyMode);
        }

        const viewJsonBtn = document.querySelector('#gvp-bottom-bar button');
        if (viewJsonBtn) {
            viewJsonBtn.addEventListener('click', () => UIController.showViewJsonModal());
        }

        const viewJsonClose = document.getElementById('gvp-view-json-close');
        if (viewJsonClose) {
            viewJsonClose.addEventListener('click', () => UIController.hideViewJsonModal());
        }

        const viewJsonCopy = document.querySelector('#gvp-view-json-footer button:nth-of-type(1)');
        if (viewJsonCopy) {
            viewJsonCopy.addEventListener('click', () => {
                const viewJsonTextarea = document.getElementById('gvp-view-json-textarea');
                if (viewJsonTextarea) {
                    viewJsonTextarea.select();
                    document.execCommand('copy');
                    alert('JSON copied to clipboard!');
                }
            });
        }

        const viewJsonExport = document.querySelector('#gvp-view-json-footer button:nth-of-type(2)');
        if (viewJsonExport) {
            viewJsonExport.addEventListener('click', exportJSON);
        }

        Debug.log('All event listeners attached');
    };

    // ============================================================================
    // DYNAMIC SCRIPT INJECTION (NEW for v10.0.1)
    // ============================================================================
    const injectScript = (options) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            if (options.src) {
                script.src = options.src;
                script.onload = resolve;
                script.onerror = reject;
            } else if (options.textContent) {
                script.textContent = options.textContent;
                resolve();
            }
            document.head.appendChild(script);
        });
    };

    // ============================================================================
    // INITIALIZATION (UPDATED for v10.1.0 - FIXED TWIND INITIALIZATION)
    // ============================================================================
    const initialize = async () => {
        Debug.log('Initializing Grok Video Prompter v10.1.0...');

        try {
            // Stage 1: Load each Twind script individually and sequentially
            await injectScript({ src: 'https://cdn.jsdelivr.net/npm/@twind/core@1.1.3' });
            Debug.log('Twind core library injected successfully.');

            await injectScript({ src: 'https://cdn.jsdelivr.net/npm/@twind/preset-autoprefix@1.0.7' });
            Debug.log('Twind preset-autoprefix injected successfully.');

            await injectScript({ src: 'https://cdn.jsdelivr.net/npm/@twind/preset-tailwind@1.1.4' });
            Debug.log('Twind preset-tailwind injected successfully.');

            // Stage 2: Execute the install command in the page's global context
            const installCommand = `
                twind.install({
                    presets: [twind.presetAutoprefix(), twind.presetTailwind()],
                });
            `;
            await injectScript({ textContent: installCommand });
            Debug.log('Twind installed and configured in page context.');

        } catch (error) {
            console.error('[GVP] CRITICAL: Could not initialize Twind. UI will not be rendered.', error);
            return;
        }

        createUI();

        const savedSettings = Storage.load('gvp-settings');
        if (savedSettings) {
            State.settings = { ...State.settings, ...savedSettings };
        }

        DataManager.initPromptData();
        NetworkInterceptor.init();
        attachEventListeners();

        const spicyModeBtn = document.querySelector('.gvp-spicy-mode-btn');
        if (spicyModeBtn && State.settings.defaultMode === 'spicy') {
            spicyModeBtn.classList.add('bg-red-700');
        }

        State.debugMode = State.settings.debugMode || false;

        // Add debug toggle console command
        window.toggleGVPDebug = () => {
            State.debugMode = !State.debugMode;
            console.log('[GVP] Debug mode is now:', State.debugMode);
        };

        Debug.log('GVP v10.0.2.0 initialized successfully');

        console.log('%cðŸŽ¬ Grok Video Prompter v10.0.2.0 Ready', 'color: #f59e0b; font-size: 16px; font-weight: bold;');
        console.log('%cFeatures:', 'color: #fbbf24; font-weight: bold;');
        console.log('  âœ" Modern Twind UI Framework (Fixed Initialization)');
        console.log('  âœ" Implemented Obsidian & Sanguine Dark Theme');
        console.log('  âœ" Array Expansion System (420px â†' 525px)');
        console.log('  âœ" Sentence Formatting (". " â†' ".\\n\\n")');
        console.log('  âœ" Custom Dropdown Values (persistent)');
        console.log('  âœ" Fullscreen Editor with word count');
        console.log('  âœ" Data collection on navigation');
        console.log('  âœ" 8 category renderers');
        console.log('  âœ" Array field management');
        console.log('  âœ" Network Interception with brace-counting parser');
        console.log('  âœ" Fixed "Grab" JSON functionality');
        console.log('  âœ" Fixed "Send" functionality with correct selectors');
        console.log('  âœ" Chained fetch override for MCP compatibility');
        console.log('  âœ" Robust polling initializer');
        console.log('%cTheme:', 'color: #fbbf24; font-weight: bold;');
        console.log('  âœ" Graphite Black (bg-gray-900, bg-gray-800)');
        console.log('  âœ" Ashy Grey Borders (border-gray-700)');
        console.log('  âœ" Sanguine Red Buttons (from-red-700 to-red-800)');
        console.log('  âœ" Golden Trimmings (border-amber-400, text-amber-400)');
        console.log('%cDebug Commands:', 'color: #f97316; font-weight: bold;');
        console.log('  window.toggleGVPDebug() - Toggle debug mode');
        console.log('%cUI powered by Twind v1.1.3 + Obsidian & Sanguine Theme', 'color: #fbbf24; font-style: italic;');
    };

    // ============================================================================
    // ROBUST INITIALIZATION
    // ============================================================================
    const waitForGrokUI = () => {
        const keyElementSelector = 'textarea[aria-label="Make a video"]';
        const interval = setInterval(() => {
            if (document.querySelector(keyElementSelector)) {
                clearInterval(interval);
                initialize();
            }
        }, 500);
    };

    // Start the robust initialization process
    waitForGrokUI();

})();
