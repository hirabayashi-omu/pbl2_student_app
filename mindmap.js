var MindMapModule = window.MindMapModule = (() => {
    // Utility
    function generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // State
    const rootId = generateUUID();
    let isEmbedded = false;
    let isEventListenersAdded = false;
    let isKeyboardShortcutsAdded = false;
    let isTouchEventsAdded = false;
    let mindMapState = {
        root: {
            id: rootId,
            text: 'プロジェクトテーマ',
            x: 0,
            y: 0,
            column: 0,
            children: []
        },
        images: [],
        columnLabels: {},
        pan: { x: 0, y: 0 },
        scale: 1,
        isDragging: false,
        lastMousePos: { x: 0, y: 0 },
        // ... (rest of state stays same)

        // DnD State
        draggedNodeId: null,
        dropTargetId: null,
        dropTargetType: null, // 'parent' or 'sibling'
        dropTargetIndex: -1,
        isNodeDragging: false,
        dragStartPos: null,
        potentialDragNodeId: null,

        // Connection Drag State
        connectionDrag: {
            active: false,
            sourceNodeId: null,
            type: null, // 'in' or 'out'
            currentPos: { x: 0, y: 0 }
        },

        // Arch Adjustment State
        archDrag: {
            active: false,
            sourceId: null,
            targetId: null,
            isRelation: false,
            dragged: false,
            cachedPath: null,
            cachedHandleGroup: null,
            startArchHeight: 0,
            startArchWidth: 0,
            startY: 0,
            startX: 0
        },

        // Node Resize
        nodeResize: {
            active: false,
            nodeId: null,
            axis: null, // 'v' or 'h'
            startY: 0,
            startX: 0,
            startSize: 0
        },

        // Image Resize/Drag
        selectedImageId: null,
        imageDrag: {
            active: false,
            id: null,
            offset: { x: 0, y: 0 }
        },
        imageResize: {
            active: false,
            id: null,
            startX: 0,
            startY: 0,
            startW: 0,
            startH: 0
        },

        selectedConnection: null, // { sourceId, targetId }
        selectedNodeId: rootId,

        contextMenu: {
            active: false,
            nodeId: null
        },
        allowedMemberIndices: null,
        // Undo/Redo
        history: [],
        future: []
    };
    const MAX_HISTORY = 50;


    function saveState() {
        // Deep copy current root mindMapState
        const snapshot = {
            root: JSON.parse(JSON.stringify(mindMapState.root)),
            images: JSON.parse(JSON.stringify(mindMapState.images)),
            columnLabels: JSON.parse(JSON.stringify(mindMapState.columnLabels))
        };
        mindMapState.history.push(snapshot);
        if (mindMapState.history.length > MAX_HISTORY) mindMapState.history.shift();
        mindMapState.future = []; // Clear redo stack on new action

        updateUndoRedoButtons();
        persistState(); // Auto-save to local storage
    }

    function persistState() {
        if (isEmbedded) return; // Don't overwrite global state if editing a task flow
        const data = {
            version: 1,
            root: mindMapState.root,
            images: mindMapState.images,
            columnLabels: mindMapState.columnLabels,
            pan: mindMapState.pan,
            scale: mindMapState.scale
        };
        localStorage.setItem('mindmap_data_v1', JSON.stringify(data));
    }

    function restoreState() {
        if (isEmbedded) return;
        const saved = localStorage.getItem('mindmap_data_v1');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.version && data.root) {
                    mindMapState.root = data.root;
                    mindMapState.images = data.images || [];
                    mindMapState.columnLabels = data.columnLabels || {};

                    // Restore pan and scale
                    if (data.pan) {
                        mindMapState.pan = data.pan;
                    }
                    if (data.scale) {
                        mindMapState.scale = data.scale;
                    }
                } else if (data.id) {
                    // old format
                    mindMapState.root = data;
                    mindMapState.images = [];
                    mindMapState.columnLabels = {};
                }
            } catch (e) {
                console.error('Failed to load mindMapState', e);
            }
        }
    }

    function clearAll() {
        if (confirm('Are you sure you want to clear EVERYTHING? This cannot be undone.')) {
            saveState(); // Save before clearing just in case
            mindMapState.root = {
                id: 'root',
                text: 'Root Problem',
                children: []
            };
            mindMapState.images = [];
            mindMapState.columnLabels = {};

            mindMapState.history = [];
            mindMapState.future = [];
            mindMapState.selectedNodeId = mindMapState.root.id;

            centerView();
            updateLayout();
            render();
            persistState();
            updateUndoRedoButtons();
        }
    }

    function undo() {
        if (mindMapState.history.length === 0) return;

        const current = {
            root: JSON.parse(JSON.stringify(mindMapState.root)),
            images: JSON.parse(JSON.stringify(mindMapState.images)),
            columnLabels: JSON.parse(JSON.stringify(mindMapState.columnLabels))
        };
        mindMapState.future.push(current);

        const previous = mindMapState.history.pop();
        mindMapState.root = previous.root;
        mindMapState.images = previous.images || [];
        mindMapState.columnLabels = previous.columnLabels || {};

        updateLayout();
        render();
        updateUndoRedoButtons();
        persistState();
        showToast('Undo');
    }

    function redo() {
        if (mindMapState.future.length === 0) return;

        const current = {
            root: JSON.parse(JSON.stringify(mindMapState.root)),
            images: JSON.parse(JSON.stringify(mindMapState.images)),
            columnLabels: JSON.parse(JSON.stringify(mindMapState.columnLabels))
        };
        mindMapState.history.push(current);

        const next = mindMapState.future.pop();
        mindMapState.root = next.root;
        mindMapState.images = next.images || [];
        mindMapState.columnLabels = next.columnLabels || {};

        updateLayout();
        render();
        updateUndoRedoButtons();
        persistState();
        showToast('Redo');
    }

    function updateUndoRedoButtons() {
        const undoBtn = currentBase.querySelector('.mm-undo-btn') || document.getElementById('mm-undo-btn');
        const redoBtn = currentBase.querySelector('.mm-redo-btn') || document.getElementById('mm-redo-btn');

        if (undoBtn) {
            undoBtn.disabled = mindMapState.history.length === 0;
            undoBtn.style.opacity = mindMapState.history.length === 0 ? '0.5' : '1';
        }

        if (redoBtn) {
            redoBtn.disabled = mindMapState.future.length === 0;
            redoBtn.style.opacity = mindMapState.future.length === 0 ? '0.5' : '1';
        }
    }

    // Config
    const CONFIG = {
        nodeWidth: 150,
        nodeHeight: 40,
        gapX: 280,
        gapY: 10,
        animationDuration: 300
    };

    const COLOR_PALETTE = [
        'rgba(30, 41, 59, 0.7)',  // Default Slate
        '#b91c1c', // Red 700
        '#c2410c', // Orange 700
        '#b45309', // Amber 700
        '#15803d', // Green 700
        '#0f766e', // Teal 700
        '#1d4ed8', // Blue 700
        '#4338ca', // Indigo 700
        '#7e22ce', // Violet 700
        '#be185d', // Pink 700
        '#475569', // Slate 600
    ];

    // Elements
    let canvasContainer, nodesLayer, connectionsLayer, gridLayer, foregroundLayer, imagesLayer, zoomLevelEl;

    // Module-level utility: sets CSS --vh variable to real viewport height (for mobile)
    function setViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // Initialization
    let isInitialized = false;
    let currentBase = document;
    function init(container = null) {
        isEmbedded = !!container;
        currentBase = container || document;

        // Select elements - prioritize global IDs when not embedded to avoid modal conflicts
        if (!isEmbedded) {
            canvasContainer = document.getElementById('mm-canvas-container');
            nodesLayer = document.getElementById('mm-nodes-layer');
            connectionsLayer = document.getElementById('mm-connections-layer');
            gridLayer = document.getElementById('mm-grid-layer');
            foregroundLayer = document.getElementById('mm-foreground-layer');
            imagesLayer = document.getElementById('mm-images-layer');
            zoomLevelEl = document.getElementById('mm-zoom-level');
        } else {
            canvasContainer = currentBase.querySelector('.mm-canvas-container');
            nodesLayer = currentBase.querySelector('.mm-nodes-layer');
            connectionsLayer = currentBase.querySelector('.mm-connections-layer');
            gridLayer = currentBase.querySelector('.mm-grid-layer');
            foregroundLayer = currentBase.querySelector('.mm-foreground-layer');
            imagesLayer = currentBase.querySelector('.mm-images-layer');
            zoomLevelEl = currentBase.querySelector('.mm-zoom-level');
        }

        console.log('MindMapModule: Initializing...', { isEmbedded, container: !!container, currentBase: currentBase.nodeName });

        if (!canvasContainer || !nodesLayer) {
            console.warn('MindMapModule: Required canvas elements not found in', isEmbedded ? 'Embedded' : 'Global', 'context.');
            console.log('Target container:', currentBase);
            // Search globally as fallback if not found in container (should not happen if HTML is correct)
            if (isEmbedded) {
                console.log('MindMapModule: Re-trying global search as fallback...');
                canvasContainer = canvasContainer || document.getElementById('mm-canvas-container');
                nodesLayer = nodesLayer || document.getElementById('mm-nodes-layer');
            }
            if (!canvasContainer || !nodesLayer) {
                console.error('MindMapModule: Critical - Cannot find canvas elements.');
                return;
            }
        }

        // For global mode: skip re-init if already done
        // For embedded mode: always re-init (new container each time)
        if (isInitialized && !container) {
            console.log('MindMapModule: Already initialized globally, refreshing...');
            // Re-verify elements just in case DOM changed
            canvasContainer = document.getElementById('mm-canvas-container');
            nodesLayer = document.getElementById('mm-nodes-layer');

            if (mindMapState.root && !mindMapState.root.text) {
                mindMapState.root.text = 'プロジェクトテーマ';
            }

            updateLayout();
            render();
            return;
        }
        // Only set isInitialized for global mode
        if (!container) {
            isInitialized = true;
        }

        setupEventListeners();
        setupInstanceButtons();
        setupKeyboardShortcuts();
        if (!isEmbedded) {
            restoreState();
        }
        initContextMenu();

        setViewportHeight();

        // Only render immediately for global mode
        // For embedded, loadData will be called right after and will render
        if (!isEmbedded) {
            updateLayout();
            render();
        }
    }

    function setupInstanceButtons() {
        const btnMap = {
            '.mm-undo-btn': undo,
            '.mm-redo-btn': redo,
            '.mm-add-child-btn': () => addNode(mindMapState.selectedNodeId),
            '.mm-add-sibling-btn': () => addSibling(mindMapState.selectedNodeId),
            '.mm-delete-btn': () => deleteNode(mindMapState.selectedNodeId),
            '.mm-center-btn': fitToScreen,
            '.mm-zoom-in': () => zoom(1.2),
            '.mm-zoom-out': () => zoom(0.8),
            '.mm-add-image-btn': () => {
                const rect = canvasContainer.getBoundingClientRect();
                const centerX = (rect.width / 2 - mindMapState.pan.x) / mindMapState.scale;
                const centerY = (rect.height / 2 - mindMapState.pan.y) / mindMapState.scale;
                addImage(centerX - 100, centerY - 75);
            },
            '.mm-clear-all-btn': clearAll,
            '.mm-move-up-btn': () => moveNodeUp(mindMapState.selectedNodeId),
            '.mm-move-down-btn': () => moveNodeDown(mindMapState.selectedNodeId),
            '.mm-export-btn': saveMap,
            '.mm-import-btn-trigger': () => {
                const inp = currentBase.querySelector('.mm-import-input') || currentBase.querySelector('#mm-import-input') || document.getElementById('mm-import-input');
                if (inp) inp.click();
            }
        };

        console.log('MindMapModule: Setting up buttons for', isEmbedded ? 'Embedded content' : 'Global content');
        for (const [selector, handler] of Object.entries(btnMap)) {
            const btn = currentBase.querySelector(selector) || document.getElementById(selector.replace('.', ''));
            if (btn) {
                // Clear existing and set new to avoid duplicate/stale handlers
                btn.onclick = null;
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handler();
                };
            } else {
                if (selector.includes('add-child') || selector.includes('add-sibling')) {
                    console.warn('MindMapModule: Vital button not found:', selector);
                }
            }
        }

        // Special case for image upload input as it's an onchange event
        const imgInput = currentBase.querySelector('#mm-image-upload-input') || document.getElementById('mm-image-upload-input');
        if (imgInput) {
            imgInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file && mindMapState.selectedImageId) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const imgIdx = mindMapState.images.findIndex(img => img.id === mindMapState.selectedImageId);
                        if (imgIdx !== -1) {
                            saveState();
                            mindMapState.images[imgIdx].src = evt.target.result;
                            render();
                        }
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            };
        }
    }

    function addImage(x, y) {
        saveState();
        const id = generateUUID();
        mindMapState.images.push({
            id: id,
            x: x,
            y: y,
            width: 200,
            height: 150,
            src: null // Empty initially
        });
        mindMapState.selectedImageId = id;
        render();
    }

    function renderImages() {
        const layer = imagesLayer;
        if (!layer) return;
        layer.innerHTML = '';

        // Transform is handled by updateView now, but setting it here initially doesn't hurt, 
        // though updateView should cover it.
        layer.style.transform = `translate(${mindMapState.pan.x}px, ${mindMapState.pan.y}px) scale(${mindMapState.scale})`;

        mindMapState.images.forEach(img => {
            const frame = document.createElement('div');
            frame.className = 'image-frame';
            if (mindMapState.selectedImageId === img.id) frame.classList.add('selected');

            frame.style.left = `${img.x}px`;
            frame.style.top = `${img.y}px`;
            frame.style.width = `${img.width}px`;
            frame.style.height = `${img.height}px`;

            if (img.src) {
                const image = document.createElement('img');
                image.src = img.src;
                frame.appendChild(image);
            } else {
                frame.innerText = 'Double-click to set image';
                frame.style.color = '#64748b';
                frame.style.fontSize = '12px';
                frame.style.textAlign = 'center';
                frame.style.userSelect = 'none';
            }

            // Resizer (only if selected)
            if (mindMapState.selectedImageId === img.id) {
                const resizer = document.createElement('div');
                resizer.className = 'image-resizer';
                resizer.onmousedown = (e) => {
                    e.stopPropagation();
                    mindMapState.imageResize.active = true;
                    mindMapState.imageResize.id = img.id;
                    mindMapState.imageResize.startX = e.clientX;
                    mindMapState.imageResize.startY = e.clientY;
                    mindMapState.imageResize.startW = img.width;
                    mindMapState.imageResize.startH = img.height;
                };
                frame.appendChild(resizer);
            }

            // Events
            frame.onmousedown = (e) => {
                hideContextMenu();
                if (e.target.classList.contains('image-resizer')) return;
                e.stopPropagation();
                if (mindMapState.selectedImageId !== img.id) {
                    mindMapState.selectedImageId = img.id;
                    render();
                }
                // Start Drag
                mindMapState.imageDrag.active = true;
                mindMapState.imageDrag.id = img.id;
                mindMapState.imageDrag.lastX = e.clientX;
                mindMapState.imageDrag.lastY = e.clientY;
            };

            frame.ondblclick = (e) => {
                e.stopPropagation();
                mindMapState.selectedImageId = img.id;
                document.getElementById('mm-image-upload-input').click();
            };

            frame.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                mindMapState.selectedImageId = img.id;

                const menu = document.createElement('div');
                menu.style.position = 'fixed';
                menu.style.left = `${e.clientX}px`;
                menu.style.top = `${e.clientY}px`;
                menu.style.background = '#1e293b';
                menu.style.border = '1px solid #334155';
                menu.style.borderRadius = '6px';
                menu.style.padding = '5px 0';
                menu.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
                menu.style.zIndex = '9999';
                menu.style.minWidth = '160px';

                const itemStyle = 'padding: 8px 16px; cursor: pointer; font-size: 14px; user-select: none; color: #f8fafc; transition: background 0.15s;';
                const hoverBg = '#334155';

                const createItem = (text, onClick, isDestructive = false) => {
                    const item = document.createElement('div');
                    item.innerText = text;
                    item.style.cssText = itemStyle;
                    if (isDestructive) item.style.color = '#ef4444';

                    item.onmouseover = () => item.style.backgroundColor = hoverBg;
                    item.onmouseout = () => item.style.backgroundColor = 'transparent';
                    item.onclick = (ev) => {
                        ev.stopPropagation();
                        menu.remove();
                        document.removeEventListener('mousedown', closeMenu);
                        onClick();
                    };
                    return item;
                };

                const changeItem = createItem('Change Image', () => {
                    document.getElementById('mm-image-upload-input').click();
                });

                const pasteItem = createItem('Paste from Clipboard', async () => {
                    try {
                        const clipboardItems = await navigator.clipboard.read();
                        for (const clipboardItem of clipboardItems) {
                            for (const type of clipboardItem.types) {
                                if (type.startsWith('image/')) {
                                    const blob = await clipboardItem.getType(type);
                                    const reader = new FileReader();
                                    reader.onload = (evt) => {
                                        const imgIdx = mindMapState.images.findIndex(i => i.id === img.id);
                                        if (imgIdx !== -1) {
                                            saveState();
                                            mindMapState.images[imgIdx].src = evt.target.result;
                                            render();
                                            showToast('Image pasted from clipboard');
                                        }
                                    };
                                    reader.readAsDataURL(blob);
                                    return; // Use first image found
                                }
                            }
                        }
                        showToast('No image found in clipboard', 'error');
                    } catch (err) {
                        console.error('Failed to read clipboard:', err);
                        showToast('Failed to paste from clipboard. Please grant clipboard permission.', 'error');
                    }
                });

                const deleteItem = createItem('Delete Image', () => {
                    deleteImage(img.id);
                }, true);

                const closeMenu = (ev) => {
                    if (!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener('mousedown', closeMenu, true);
                    }
                };

                menu.appendChild(changeItem);
                menu.appendChild(pasteItem);
                menu.appendChild(deleteItem);
                document.body.appendChild(menu);

                setTimeout(() => document.addEventListener('mousedown', closeMenu, true), 0);
            };

            layer.appendChild(frame);
        });
    }


    // Data Handling
    function findNode(id, node = mindMapState.root) {
        if (node.id === id) return node;
        for (const child of node.children) {
            const found = findNode(id, child);
            if (found) return found;
        }
        return null;
    }

    function findParent(id, node = mindMapState.root) {
        for (const child of node.children) {
            if (child.id === id) return node;
            const found = findParent(id, child);
            if (found) return found;
        }
        return null;
    }

    function addNode(parentId, text = 'New Node') {
        saveState();
        const parent = findNode(parentId);
        if (!parent) return;

        const newNode = {
            id: generateUUID(),
            text: text,
            children: [],
            column: (parent.column || 0) + 1
        };

        // Insert in the middle of existing children to keep the tree balanced
        const insertIdx = Math.floor(parent.children.length / 2);
        parent.children.splice(insertIdx, 0, newNode);

        mindMapState.selectedNodeId = newNode.id;
        updateLayout();
        render();

        // Focus after render
        setTimeout(() => enterEditMode(newNode.id), 50);
    }

    function addSibling(id) {
        if (id === mindMapState.root.id) return; // Can't add sibling to root
        const parent = findParent(id);
        if (parent) {
            addNode(parent.id);
        }
    }

    // Keyboard Shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }

            // Existing Shortcuts (moved logic here if needed, or kept in existing listener)
            // Currently existing listener handles Tab, Enter, etc. 
            // We can keep them separate or merge. 
            // The existing setupEventListeners handles them.
        });
    }

    function deleteNode(id) {
        if (id === mindMapState.root.id) return; // Can't delete root
        saveState();
        const parent = findParent(id);
        if (!parent) return;

        const index = parent.children.findIndex(c => c.id === id);
        if (index !== -1) {
            parent.children.splice(index, 1);
            mindMapState.selectedNodeId = parent.id;
            updateLayout();
            render();
        }
    }


    function deleteImage(id) {
        saveState();
        const idx = mindMapState.images.findIndex(img => img.id === id);
        if (idx !== -1) {
            mindMapState.images.splice(idx, 1);
            mindMapState.selectedImageId = null;
            render();
        }
    }

    function deleteConnection(sourceId, targetId) {
        saveState();
        const source = findNode(sourceId);
        if (!source) return;

        // Remove from relations
        source.relations = source.relations.filter(r => {
            const rId = (typeof r === 'string') ? r : r.id;
            return rId !== targetId;
        });
        render();
    }

    function updateNodeText(id, text) {
        const node = findNode(id);
        if (node && node.text !== text) {
            saveState();
            node.text = text;
            render();
        }
    }

    // Data Handling Helpers
    function moveNodeUp(id) {
        if (id === mindMapState.root.id) return;
        saveState();
        const parent = findParent(id);
        if (!parent) return;

        const index = parent.children.findIndex(c => c.id === id);
        if (index > 0) {
            // Swap with previous
            const temp = parent.children[index];
            parent.children[index] = parent.children[index - 1];
            parent.children[index - 1] = temp;
            updateLayout();
            render();
        }
    }

    function moveNodeDown(id) {
        if (id === mindMapState.root.id) return;
        saveState();
        const parent = findParent(id);
        if (!parent) return;

        const index = parent.children.findIndex(c => c.id === id);
        if (index !== -1 && index < parent.children.length - 1) {
            // Swap with next
            const temp = parent.children[index];
            parent.children[index] = parent.children[index + 1];
            parent.children[index + 1] = temp;
            updateLayout();
            render();
        }
    }

    function toggleRelation(sourceId, targetId, arch = 'auto') {
        if (sourceId === targetId) return;

        saveState();
        const source = findNode(sourceId);
        const target = findNode(targetId);

        if (!source || !target) return;

        // Initialize if missing
        if (!source.relations) source.relations = [];

        // Find if target already exists (handle both string and object formats)
        const index = source.relations.findIndex(r => (typeof r === 'string' ? r === targetId : r.id === targetId));

        if (index !== -1) {
            // Only toggle off if we are not just updating props (handled by separate logic usually)
            // But here simpler to just toggle.
            source.relations.splice(index, 1);
            showToast('Connection removed.');
        } else {
            // Add new relation with the chosen arch direction
            source.relations.push({ id: targetId, arch: arch, label: '' });
            showToast('Connection added.');
        }
        render();
    }

    function updateConnectionLabel(sourceId, targetId, isRelation, label) {
        saveState();
        if (isRelation) {
            const source = findNode(sourceId);
            if (source && source.relations) {
                const rel = source.relations.find(r => (typeof r === 'string' ? r === targetId : r.id === targetId));
                if (rel) {
                    if (typeof rel === 'string') {
                        // Convert to object
                        const idx = source.relations.indexOf(rel);
                        source.relations[idx] = { id: targetId, label: label, arch: 'auto' };
                    } else {
                        rel.label = label;
                    }
                }
            }
        } else {
            // Child connection label stored on child
            const child = findNode(targetId);
            if (child) {
                child.connectionLabel = label;
            }
        }
        render();
    }

    function updateConnectionColor(sourceId, targetId, isRelation, color) {
        saveState();
        if (isRelation) {
            const source = findNode(sourceId);
            if (source && source.relations) {
                const rel = source.relations.find(r => (typeof r === 'string' ? r === targetId : r.id === targetId));
                if (rel) {
                    if (typeof rel === 'string') {
                        const idx = source.relations.indexOf(rel);
                        source.relations[idx] = { id: targetId, label: '', arch: 'auto', color: color };
                    } else {
                        rel.color = color;
                    }
                }
            }
        } else {
            const child = findNode(targetId);
            if (child) {
                child.connectionColor = color;
            }
        }
        render();
    }

    function updateConnectionWidth(sourceId, targetId, isRelation, width) {
        saveState();
        if (isRelation) {
            const source = findNode(sourceId);
            if (source && source.relations) {
                const rel = source.relations.find(r => (typeof r === 'string' ? r === targetId : r.id === targetId));
                if (rel) {
                    if (typeof rel === 'string') {
                        const idx = source.relations.indexOf(rel);
                        source.relations[idx] = { id: targetId, label: '', arch: 'auto', width: width };
                    } else {
                        rel.width = width;
                    }
                }
            }
        } else {
            const child = findNode(targetId);
            if (child) {
                child.connectionWidth = width;
            }
        }
        render();
    }

    function updateConnectionStyle(sourceId, targetId, isRelation, dashArray) {
        saveState();
        if (isRelation) {
            const source = findNode(sourceId);
            if (source && source.relations) {
                const rel = source.relations.find(r => (typeof r === 'string' ? r === targetId : r.id === targetId));
                if (rel) {
                    if (typeof rel === 'string') {
                        const idx = source.relations.indexOf(rel);
                        source.relations[idx] = { id: targetId, label: '', arch: 'auto', dashArray: dashArray };
                    } else {
                        rel.dashArray = dashArray;
                    }
                }
            }
        } else {
            const child = findNode(targetId);
            if (child) {
                child.connectionDashArray = dashArray;
            }
        }
        render();
    }



    function initContextMenu() {
        let menu = document.getElementById('context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'context-menu';
            menu.className = 'context-menu hidden';
            document.body.appendChild(menu);

            // Close on mousedown outside
            document.addEventListener('mousedown', (e) => {
                if (!e.target.closest('#context-menu')) {
                    hideContextMenu();
                }
            }, true);

            // Close on escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') hideContextMenu();
            }, true);
        }

        // We will populate the menu in showContextMenu based on the node
    }

    function showContextMenu(nodeId, x, y) {
        mindMapState.contextMenu.nodeId = nodeId;
        mindMapState.contextMenu.active = true;
        const menu = document.getElementById('context-menu');
        const node = findNode(nodeId);
        if (!menu || !node) return;

        menu.innerHTML = '';
        menu.classList.remove('hidden');

        // Helper to create items
        const createItem = (text, icon, onClick, isDestructive = false) => {
            const item = document.createElement('div');
            item.className = isDestructive ? 'context-menu-item destructive' : 'context-menu-item';
            item.innerHTML = `<i class="fas ${icon}"></i> <span>${text}</span>`;
            item.onclick = (e) => {
                e.stopPropagation();
                onClick();
                hideContextMenu();
            };
            return item;
        };

        // Actions
        menu.appendChild(createItem('子ノードを追加', 'fa-level-down-alt', () => addNode(nodeId)));

        if (nodeId !== mindMapState.root.id) {
            menu.appendChild(createItem('兄弟ノードを追加', 'fa-plus', () => addSibling(nodeId)));
            menu.appendChild(createItem('上に移動', 'fa-arrow-up', () => moveNodeUp(nodeId)));
            menu.appendChild(createItem('下に移動', 'fa-arrow-down', () => moveNodeDown(nodeId)));

            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            menu.appendChild(separator);

            menu.appendChild(createItem('ノードを削除', 'fa-trash', () => deleteNode(nodeId), true));
        }

        const separator2 = document.createElement('div');
        separator2.className = 'context-menu-separator';
        menu.appendChild(separator2);

        // Color Palette
        const swatchContainer = document.createElement('div');
        swatchContainer.className = 'color-swatch-container';

        COLOR_PALETTE.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = color;

            swatch.onclick = (e) => {
                e.stopPropagation();
                saveState();
                node.color = color;
                render();
                hideContextMenu();
            };
            swatchContainer.appendChild(swatch);
        });
        menu.appendChild(swatchContainer);

        // Assignees (if configured)
        if (mindMapState.allowedMemberIndices && mindMapState.allowedMemberIndices.length > 0 && typeof state !== 'undefined' && state.members) {
            const separator3 = document.createElement('div');
            separator3.className = 'context-menu-separator';
            menu.appendChild(separator3);

            const assigneeContainer = document.createElement('div');
            assigneeContainer.className = 'assignee-selector-container';
            assigneeContainer.style.padding = '4px 8px';
            assigneeContainer.style.display = 'flex';
            assigneeContainer.style.gap = '4px';
            assigneeContainer.style.flexWrap = 'wrap';

            // Ensure node.assignees exists
            const currentAssignees = node.assignees || [];

            mindMapState.allowedMemberIndices.forEach(idx => {
                const m = state.members[idx];
                if (!m) return;

                const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];
                const color = m.avatarColor || AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const initial = (m.lastName || '?').slice(0, 1);
                const isSelected = currentAssignees.includes(idx);

                const avatar = document.createElement('div');
                avatar.title = `${m.lastName} ${m.firstName || ''}`;
                avatar.style.cssText = `
                    width: 24px; height: 24px; border-radius: 50%;
                    background: ${m.avatarImage ? 'transparent' : color};
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; position: relative;
                    border: 2px solid ${isSelected ? '#fff' : 'transparent'};
                    box-shadow: ${isSelected ? '0 0 0 2px var(--primary)' : 'none'};
                    overflow: hidden; flex-shrink: 0;
                `;

                if (m.avatarImage) {
                    avatar.innerHTML = `<img src="${m.avatarImage}" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    avatar.innerHTML = `<span style="font-size:10px;font-weight:bold;color:white;">${initial}</span>`;
                }

                avatar.onclick = (e) => {
                    e.stopPropagation();
                    saveState(); // Save before modifying
                    if (!node.assignees) node.assignees = [];

                    if (node.assignees.includes(idx)) {
                        node.assignees = node.assignees.filter(i => i !== idx);
                        avatar.style.borderColor = 'transparent';
                        avatar.style.boxShadow = 'none';
                    } else {
                        node.assignees.push(idx);
                        avatar.style.borderColor = '#fff';
                        avatar.style.boxShadow = '0 0 0 2px var(--primary)';
                    }
                    render();
                };

                assigneeContainer.appendChild(avatar);
            });
            menu.appendChild(assigneeContainer);
        }

        // Position
        menu.style.display = 'block'; // Ensure it's measurable
        const rect = menu.getBoundingClientRect();
        let left = x + 5;
        let top = y + 5;

        // Bounds check
        if (left + rect.width > window.innerWidth) left = x - rect.width - 5;
        if (top + rect.height > window.innerHeight) top = y - rect.height - 5;

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function hideContextMenu() {
        mindMapState.contextMenu.active = false;
        mindMapState.contextMenu.nodeId = null;
        const menu = document.getElementById('context-menu');
        if (menu) {
            menu.classList.add('hidden');
            menu.style.display = 'none'; // Overwrite inline block style
        }
    }

    function moveNodeTo(nodeId, newParentId) {
        if (nodeId === newParentId) return; // Can't move to self

        if (isDescendant(nodeId, newParentId)) {
            showToast('Cannot move a node into its own child.', 'error');
            return;
        }

        saveState();
        const node = findNode(nodeId);
        const oldParent = findParent(nodeId);
        const newParent = findNode(newParentId);

        if (node && oldParent && newParent) {
            const index = oldParent.children.findIndex(c => c.id === nodeId);
            oldParent.children.splice(index, 1);

            newParent.children.push(node);

            // Update column of moved subtree
            updateColumnsRecursive(node, (newParent.column || 0) + 1);

            updateLayout();
            render();
            showToast('Node moved successfully.');
        }
    }

    function updateColumnsRecursive(node, startColumn) {
        node.column = startColumn;
        if (node.children) {
            node.children.forEach(child => updateColumnsRecursive(child, startColumn + 1));
        }
    }

    function isDescendant(parentId, childId) {
        const parent = findNode(parentId);
        if (!parent) return false;
        return !!findNode(childId, parent) && childId !== parentId;
    }

    function insertIntermediateNode(sourceId, targetId, isRelation) {
        saveState();
        const source = findNode(sourceId);
        const target = findNode(targetId);
        if (!source || !target) return;

        const intermediateId = generateUUID();
        const intermediateNode = {
            id: intermediateId,
            text: '...',
            children: [],
            relations: [],
            column: (source.column || 0) + 1
        };

        // If adding a generation in the middle of a direct link
        const isAdjacent = (target.column === source.column + 1);
        if (isAdjacent) {
            shiftColumns(intermediateNode.column);
            showToast('Generation added.');
        } else {
            showToast('Step inserted in existing gap.');
        }

        if (isRelation) {
            // Relation: Source -> Intermediate (Child) -> Target (Relation)
            const idx = (source.relations || []).findIndex(r =>
                (typeof r === 'string' ? r === targetId : r.id === targetId)
            );

            if (idx !== -1) {
                const oldRelation = source.relations[idx];
                source.relations.splice(idx, 1);

                if (!source.children) source.children = [];

                // Insert at "Balanced" vertical position
                const midY = (source.y + target.y) / 2;
                let insertIdx = source.children.length;
                for (let i = 0; i < source.children.length; i++) {
                    if (source.children[i].y > midY) {
                        insertIdx = i;
                        break;
                    }
                }
                source.children.splice(insertIdx, 0, intermediateNode);

                const archPref = typeof oldRelation === 'string' ? 'auto' : (oldRelation.arch || 'auto');
                intermediateNode.relations.push({ id: targetId, arch: archPref });
            }
        } else {
            // Tree: Parent (source) -> Intermediate -> Child (target)
            const parent = source;
            const childIdx = parent.children.findIndex(c => c.id === targetId);

            if (childIdx !== -1) {
                const childNode = parent.children[childIdx];
                // Replace child with intermediate
                parent.children[childIdx] = intermediateNode;
                // Move child to be under intermediate
                intermediateNode.children.push(childNode);

                // Note: Vertical order is preserved as it takes the child's old index
            }
        }

        updateLayout();
        render();
        setTimeout(() => enterEditMode(intermediateId), 50);
    }

    function shiftColumns(threshold) {
        const traverse = (node) => {
            if (node.column >= threshold) {
                node.column += 1;
            }
            if (node.children) node.children.forEach(traverse);
        };
        traverse(mindMapState.root);
    }

    // Layout Engine (Simple Tree)
    function updateLayout() {
        const root = mindMapState.root;

        const columnMaxWidths = {};
        function findMaxWidths(node) {
            const col = node.column || 0;
            const w = node.customWidth || node.measuredWidth || CONFIG.nodeWidth;
            columnMaxWidths[col] = Math.max(columnMaxWidths[col] || 0, w);
            if (node.children) node.children.forEach(findMaxWidths);
        }
        findMaxWidths(root);
        mindMapState.columnMaxWidths = columnMaxWidths; // Save for centering in positionNodes

        const columnOffsets = { 0: 0 };
        const cols = Object.keys(columnMaxWidths).map(Number).sort((a, b) => a - b);
        const gapBetween = 100;
        for (let i = 1; i < cols.length; i++) {
            const prevCol = cols[i - 1];
            const currCol = cols[i];
            columnOffsets[currCol] = columnOffsets[prevCol] + columnMaxWidths[prevCol] + gapBetween;
        }
        mindMapState.columnOffsets = columnOffsets;

        calculateSubtreeHeight(root);
        positionNodes(root, -root.subtreeHeight / 2);
    }

    function calculateSubtreeHeight(node) {
        if (!node.children || node.children.length === 0) {
            // Respect customHeight > measuredHeight > default
            node.subtreeHeight = node.customHeight || node.measuredHeight || CONFIG.nodeHeight;
            return node.subtreeHeight;
        }

        let childrenHeight = 0;
        node.children.forEach(child => {
            childrenHeight += calculateSubtreeHeight(child);
        });

        childrenHeight += (node.children.length - 1) * CONFIG.gapY;

        // Node's own height contribution
        const ownHeight = node.customHeight || node.measuredHeight || CONFIG.nodeHeight;
        node.subtreeHeight = Math.max(ownHeight, childrenHeight);
        return node.subtreeHeight;
    }

    function positionNodes(node, startY) {
        const col = node.column || 0;

        // Left-aligned within the column offset
        node.x = mindMapState.columnOffsets[col] || (col * (CONFIG.nodeWidth + 100));

        node.y = startY + node.subtreeHeight / 2;

        if (node.children && node.children.length > 0) {
            let totalChildrenHeight = 0;
            node.children.forEach(child => {
                totalChildrenHeight += child.subtreeHeight;
            });
            totalChildrenHeight += (node.children.length - 1) * CONFIG.gapY;

            // Vertically centered relative to the parent's span
            let currentY = startY + (node.subtreeHeight - totalChildrenHeight) / 2;

            node.children.forEach(child => {
                positionNodes(child, currentY);
                currentY += child.subtreeHeight + CONFIG.gapY;
            });
        }
    }

    // Rendering
    function updateView() {
        const cssTransform = `translate(${mindMapState.pan.x}px, ${mindMapState.pan.y}px) scale(${mindMapState.scale})`;
        const svgTransform = `translate(${mindMapState.pan.x}, ${mindMapState.pan.y}) scale(${mindMapState.scale})`;

        nodesLayer.style.transform = cssTransform;
        if (imagesLayer) imagesLayer.style.transform = cssTransform;

        // Update SVG transforms
        [connectionsLayer, foregroundLayer, gridLayer].forEach(layer => {
            const g = layer.querySelector('g');
            if (g) g.setAttribute('transform', svgTransform);
        });

        if (zoomLevelEl) {
            zoomLevelEl.textContent = `${Math.round(mindMapState.scale * 100)}%`;
        }
    }

    function render() {
        if (!mindMapState.root) {
            console.error('MindMapModule: Cannot render, root node is missing.');
            return;
        }
        if (!nodesLayer) {
            console.error('MindMapModule: Cannot render, nodesLayer is null.');
            return;
        }

        renderImages(); // Render Images Layer

        // 1. Initial Render Nodes (To get them into DOM for measurement)
        nodesLayer.innerHTML = '';
        renderNodeRecursive(mindMapState.root);

        // 2. Measure actual dimensions from DOM
        measureNodesRecursive(mindMapState.root);

        // 3. Update Layout with actual sizes
        updateLayout();

        // 4. Update Node Positions in DOM
        applyNodePositionsRecursive(mindMapState.root);

        // 5. Render Connections
        const layers = [
            { el: gridLayer, id: 'grid' },
            { el: connectionsLayer, id: 'bg' },
            { el: foregroundLayer, id: 'fg' }
        ];

        layers.forEach(layer => {
            let g = layer.el.querySelector('g.content-group');
            if (!g) {
                g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('class', 'content-group');
                layer.el.appendChild(g);
            }
            g.innerHTML = ''; // Clear only contents
            const svgTransform = `translate(${mindMapState.pan.x}, ${mindMapState.pan.y}) scale(${mindMapState.scale})`;
            g.setAttribute('transform', svgTransform);
            layer.g = g;
        });

        const gridG = layers[0].g;
        const bgG = layers[1].g;
        const fgG = layers[2].g;

        // Render Grid Lines (Generations)
        if (mindMapState.columnOffsets) {
            const cols = Object.keys(mindMapState.columnOffsets).map(Number).sort((a, b) => a - b);
            const gapBetween = 100;

            cols.forEach((col, i) => {
                if (i > 0) {
                    const prevCol = cols[i - 1];
                    const x = mindMapState.columnOffsets[col] - (gapBetween / 2);

                    // Vertical Line
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('class', 'generation-line');
                    line.setAttribute('x1', x);
                    line.setAttribute('y1', -5000);
                    line.setAttribute('x2', x);
                    line.setAttribute('y2', 5000);
                    gridG.appendChild(line);

                    // Generation Label
                    const labelY = -mindMapState.root.subtreeHeight / 2 - 60;

                    if (mindMapState.editingLabelColumn === col) {
                        // Editable Input Mode using ForeignObject
                        const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
                        fo.setAttribute('x', x - 60);
                        fo.setAttribute('y', labelY - 15);
                        fo.setAttribute('width', 120);
                        fo.setAttribute('height', 40);

                        const input = document.createElement('input');
                        input.value = (mindMapState.columnLabels && mindMapState.columnLabels[col]) || `GEN ${col}`;
                        input.className = 'generation-label-input'; // define in CSS
                        input.style.width = '100%';
                        input.style.height = '100%';
                        input.style.textAlign = 'center';
                        input.style.background = 'rgba(15, 23, 42, 0.9)';
                        input.style.color = '#fff';
                        input.style.border = '1px solid #3b82f6';
                        input.style.borderRadius = '4px';

                        // Save on blur or enter
                        const saveLabel = () => {
                            if (!mindMapState.columnLabels) mindMapState.columnLabels = {};
                            mindMapState.columnLabels[col] = input.value;
                            mindMapState.editingLabelColumn = null;
                            render();
                        };

                        input.addEventListener('blur', saveLabel);
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                saveLabel();
                            }
                            e.stopPropagation();
                        });

                        // Auto-focus logic
                        setTimeout(() => {
                            input.focus();
                            input.select();
                        }, 0);

                        fo.appendChild(input);
                        gridG.appendChild(fo);

                    } else {
                        // Display Mode
                        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        label.setAttribute('class', 'generation-label');
                        label.setAttribute('x', x);
                        label.setAttribute('y', labelY);
                        label.textContent = (mindMapState.columnLabels && mindMapState.columnLabels[col]) || `GEN ${col}`;

                        // Double click to edit
                        label.addEventListener('dblclick', (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            mindMapState.editingLabelColumn = col;
                            render();
                        });

                        // Make it really clickable
                        label.style.pointerEvents = 'auto';
                        label.style.cursor = 'text';

                        gridG.appendChild(label);
                    }
                }
            });
        }

        // Regular Tree Connections
        renderConnectionsRecursive(mindMapState.root, bgG, fgG);

        // Extra Relations
        renderRelationsRecursive(mindMapState.root, bgG, fgG);
        // Connection Drag Line
        if (mindMapState.connectionDrag.active) {
            const sourceNode = findNode(mindMapState.connectionDrag.sourceNodeId);
            if (sourceNode) {
                let startX = sourceNode.x;
                let startY = sourceNode.y;

                const el = nodesLayer.querySelector(`[data-id="${sourceNode.id}"]`);
                if (el) {
                    const offset = 6;
                    startX = mindMapState.connectionDrag.type === 'out'
                        ? sourceNode.x + el.offsetWidth + offset
                        : sourceNode.x - offset;
                }

                const rect = canvasContainer.getBoundingClientRect();
                const worldMouseX = (mindMapState.connectionDrag.currentPos.x - rect.left - mindMapState.pan.x) / mindMapState.scale;
                const worldMouseY = (mindMapState.connectionDrag.currentPos.y - rect.top - mindMapState.pan.y) / mindMapState.scale;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('class', 'connection drag');
                path.setAttribute('stroke', '#fbbf24');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('stroke-dasharray', '5,5');
                path.setAttribute('fill', 'none');
                path.setAttribute('marker-end', 'url(#arrow-drag)');

                let c1x = startX + (worldMouseX - startX) / 2;
                let c1y = startY;
                let c2x = worldMouseX - (worldMouseX - startX) / 2;
                let c2y = worldMouseY;

                const relativeX = worldMouseX - startX;
                const colStepApprox = Math.round(relativeX / CONFIG.gapX);
                const isInBezierWindow = relativeX > CONFIG.gapX * 0.6 &&
                    relativeX < CONFIG.gapX * 1.4 &&
                    Math.abs(worldMouseY - startY) < 50;

                if (!isInBezierWindow) {
                    if (colStepApprox <= 0) {
                        const curveWidth = 70;
                        c1x = startX + curveWidth; c2x = worldMouseX + curveWidth;
                        c1y = startY; c2y = worldMouseY;
                    } else {
                        const absStep = Math.max(1, colStepApprox);
                        const archHeight = 80 + (absStep > 1 ? (absStep - 1) * 30 : 0);
                        if (worldMouseY <= startY) {
                            const topY = Math.min(startY, worldMouseY) - archHeight;
                            c1y = topY; c2y = topY;
                        } else {
                            const bottomY = Math.max(startY, worldMouseY) + archHeight;
                            c1y = bottomY; c2y = bottomY;
                        }
                        const sign = (worldMouseX > startX) ? 1 : -1;
                        c1x = startX + (60 * sign); c2x = worldMouseX - (60 * sign);
                    }
                }

                const d = `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${worldMouseX} ${worldMouseY}`;
                path.setAttribute('d', d);
                bgG.appendChild(path);
            }
        }

        // Apply current transforms
        updateView();
    }

    function renderConnectionsRecursive(node, bgG, fgG) {
        if (node.children) {
            node.children.forEach(child => {
                drawConnection(node, child, bgG, fgG, false, 0, 'auto', child.customArchWidth, child.customArchHeight);
                renderConnectionsRecursive(child, bgG, fgG);
            });
        }
    }

    function renderRelationsRecursive(node, bgG, fgG) {
        if (node.relations) {
            node.relations.forEach((relation, index) => {
                const targetId = typeof relation === 'string' ? relation : relation.id;
                const archPreference = typeof relation === 'string' ? 'auto' : (relation.arch || 'auto');
                const customW = typeof relation === 'string' ? null : relation.archWidth;
                const customH = typeof relation === 'string' ? null : relation.archHeight;

                const target = findNode(targetId);
                if (target) {
                    drawConnection(node, target, bgG, fgG, true, index, archPreference, customW, customH);
                }
            });
        }
        if (node.children) {
            node.children.forEach(child => renderRelationsRecursive(child, bgG, fgG));
        }
    }

    function measureNodesRecursive(node) {
        const el = nodesLayer.querySelector(`[data-id="${node.id}"]`);
        if (el) {
            node.measuredHeight = el.offsetHeight;
            node.measuredWidth = el.offsetWidth;
        }
        if (node.children) node.children.forEach(measureNodesRecursive);
    }

    function applyNodePositionsRecursive(node) {
        const el = nodesLayer.querySelector(`[data-id="${node.id}"]`);
        if (el) {
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;
        }
        if (node.children) node.children.forEach(applyNodePositionsRecursive);
    }

    function renderNodeRecursive(node) {
        const el = document.createElement('div');

        let classes = ['node'];
        if (node.id === mindMapState.selectedNodeId) classes.push('selected');
        if (node.id === mindMapState.root.id) classes.push('root');
        if ((node.id === mindMapState.dropTargetId && mindMapState.isNodeDragging) ||
            (node.id === mindMapState.dropTargetId && mindMapState.connectionDrag.active)) {
            classes.push('drop-target');
        }
        if (node.id === mindMapState.draggedNodeId && mindMapState.isNodeDragging) classes.push('dragging');

        el.className = classes.join(' ');
        el.dataset.id = node.id;
        el.innerText = node.text || '';


        if (node.color) {
            el.style.backgroundColor = node.color;
            // Improve visibility for custom colors
            el.style.borderColor = 'rgba(255,255,255,0.2)';
        }

        // Render Assignee Avatars (Top-Right)
        if (node.assignees && node.assignees.length > 0 && typeof state !== 'undefined' && state.members) {
            const avatarGroup = document.createElement('div');
            avatarGroup.className = 'node-assignees';
            avatarGroup.style.cssText = `
                position: absolute; top: -8px; right: -8px;
                display: flex; pointer-events: none; z-index: 5;
            `;

            node.assignees.forEach(idx => {
                const m = state.members[idx];
                if (!m) return;

                const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];
                const color = m.avatarColor || AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const initial = (m.lastName || '?').slice(0, 1);

                const av = document.createElement('div');
                av.style.cssText = `
                    width: 18px; height: 18px; border-radius: 50%;
                    background: ${m.avatarImage ? '#fff' : color};
                    border: 1px solid white;
                    margin-left: -6px;
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                `;

                if (m.avatarImage) {
                    av.innerHTML = `<img src="${m.avatarImage}" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    av.innerHTML = `<span style="font-size:9px;font-weight:700;color:white;line-height:1;">${initial}</span>`;
                }
                avatarGroup.appendChild(av);
            });
            el.appendChild(avatarGroup);
        }


        // Position (center origin logic in CSS vs top-left here)
        // Let's say node.y is center, node.x is left.
        // CSS transform translate.

        // Just force a reflow to get dimensions?
        // We used fixed steps in layout, but node width varies.
        // Let's center vertically on y, left aligned on x.
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        el.style.transform = 'translate(0, -50%)'; // Center vertically

        if (node.customWidth) el.style.width = `${node.customWidth}px`;
        if (node.customHeight) {
            el.style.height = `${node.customHeight}px`;
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
        }

        // Reorder indicator (visual line)
        if (mindMapState.isNodeDragging && mindMapState.dropTargetId === node.id && mindMapState.dropTargetType === 'sibling') {
            const indicator = document.createElement('div');
            indicator.className = 'reorder-indicator';

            // Find index of target in its parent to decide if indicator goes top or bottom
            const parent = findParent(node.id);
            const draggedParent = findParent(mindMapState.draggedNodeId);
            if (parent && draggedParent && parent.id === draggedParent.id) {
                const children = parent.children;
                const targetIdx = children.findIndex(c => c.id === node.id);
                const draggedIdx = children.findIndex(c => c.id === mindMapState.draggedNodeId);

                // Logic to match calculateSubtreeHeight/mousemove logic:
                // mindMapState.dropTargetIndex is the splice target.
                if (mindMapState.dropTargetIndex <= targetIdx) {
                    indicator.classList.add('top');
                } else {
                    indicator.classList.add('bottom');
                }
                el.appendChild(indicator);
            }
        }

        // Events
        el.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(node.id, e.clientX, e.clientY);
        };

        el.onmousedown = (e) => {
            hideContextMenu();
            if (e.button !== 0) return; // Left click only

            // Check if handle clicked
            if (e.target.classList.contains('handle')) {
                e.stopPropagation();
                const type = e.target.classList.contains('in') ? 'in' : 'out';
                mindMapState.connectionDrag.active = true;
                mindMapState.connectionDrag.sourceNodeId = node.id;
                mindMapState.connectionDrag.type = type;
                mindMapState.connectionDrag.currentPos = { x: e.clientX, y: e.clientY };
                canvasContainer.style.cursor = 'crosshair';

                // Visual cue for candidates
                canvasContainer.classList.add(`dragging-${type}`);
                return;
            }

            e.stopPropagation();

            mindMapState.dragStartPos = { x: e.clientX, y: e.clientY };

            // Delay selection logic to mouseup to distinguish drag vs click
            // But we need to handle "start dragging"

            // We handle logic in global mousemove/up
            mindMapState.potentialDragNodeId = node.id;
        };

        el.ondblclick = (e) => {
            e.stopPropagation();
            enterEditMode(node.id);
        };

        // Handles
        if (node.id !== mindMapState.root.id) {
            const inHandle = document.createElement('div');
            inHandle.className = 'handle in';
            inHandle.title = 'Drag to change Parent';
            el.appendChild(inHandle);
        }

        const outHandle = document.createElement('div');
        outHandle.className = 'handle out';
        outHandle.title = 'Drag to add Child/Relation';
        el.appendChild(outHandle);

        nodesLayer.appendChild(el);

        node.children.forEach(child => renderNodeRecursive(child));
    }

    function drawConnection(source, target, bgG, fgG, isRelation, index = 0, archPreference = 'auto', customArchWidth = null, customArchHeight = null) {
        const parentEl = nodesLayer.querySelector(`[data-id="${source.id}"]`);
        const targetEl = nodesLayer.querySelector(`[data-id="${target.id}"]`);

        // Label logic
        let labelText = '';
        if (isRelation) {
            if (source.relations) {
                const rel = source.relations[index]; // Note: index passed might not rely on source.relations order if we iterate differently? 
                // Actually renderRelationsRecursive passes index corresponding to forEach.
                // Safety check:
                if (rel) {
                    labelText = (typeof rel === 'object' && rel.label) ? rel.label : '';
                }
            }
        } else {
            labelText = target.connectionLabel || '';
        }

        if (parentEl && targetEl) {
            const isSelected = mindMapState.selectedConnection && mindMapState.selectedConnection.sourceId === source.id && mindMapState.selectedConnection.targetId === target.id;
            const targetGroup = isSelected ? fgG : bgG;

            const pWidth = parentEl.offsetWidth;
            let pX = source.x + pWidth;
            let pY = source.y;

            if (isRelation) pY += 6 + (index * 6);
            let cX = target.x - 4;
            let cY = target.y;
            if (isRelation) cY += 6;

            let c1x, c1y, c2x, c2y;
            const colStep = (target.column || 0) - (source.column || 0);
            const absStep = Math.abs(colStep);
            const isSelfLoop = (source.id === target.id);
            const shouldArch = colStep !== 1 || isSelfLoop || customArchWidth !== null || customArchHeight !== null;

            if (shouldArch) {
                if (isSelfLoop) {
                    const nodeH = parentEl.offsetHeight;
                    const spreadOffset = nodeH * 0.4;
                    pY = source.y - spreadOffset;
                    cY = source.y + spreadOffset;
                    pX = source.x + pWidth;
                    cX = source.x - 4; // Wraparound flow

                    const W = (customArchWidth !== null) ? customArchWidth : 120;
                    const H = (customArchHeight !== null) ? customArchHeight : 90;

                    // Symmetric weights lock handle to horizontal midpoint
                    c1x = pX + W;
                    c2x = cX - W;
                    c1y = pY - H;
                    c2y = cY - H;
                } else if (colStep <= 0) {
                    const W = (customArchWidth !== null) ? customArchWidth : 70;
                    const H = (customArchHeight !== null) ? customArchHeight : 60;
                    const side = (archPreference === 'down') ? 1 : -1;

                    c1x = pX + W;
                    c2x = cX - W;
                    c1y = pY + H * side;
                    c2y = cY + H * side;
                } else {
                    const W = (customArchWidth !== null) ? customArchWidth : 60;
                    const H = (customArchHeight !== null) ? customArchHeight : (80 + (absStep > 1 ? (absStep - 1) * 30 : 0));
                    const useUp = (archPreference === 'up') || (archPreference === 'auto' && cY <= pY);
                    const side = useUp ? -1 : 1;

                    c1x = pX + W;
                    c2x = cX - W;
                    c1y = pY + H * side;
                    c2y = cY + H * side;
                }
            } else {
                c1x = pX + (cX - pX) / 2; c1y = pY;
                c2x = cX - (cX - pX) / 2; c2y = cY;
            }

            const d = `M ${pX} ${pY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${cX} ${cY}`;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            let connClass = isRelation ? 'connection relation' : 'connection';
            if (isSelected) connClass += ' selected';
            path.setAttribute('class', connClass);
            path.setAttribute('d', d);
            path.dataset.source = source.id;
            path.dataset.target = target.id;
            path.dataset.isRelation = isRelation;

            // Apply custom color and width
            let customColor = null;
            let customWidth = null;
            let customDashArray = null;

            if (isRelation) {
                const rel = source.relations.find(r => (typeof r === 'string' ? r === target.id : r.id === target.id));
                if (rel && typeof rel === 'object') {
                    customColor = rel.color;
                    customWidth = rel.width;
                    customDashArray = rel.dashArray;
                }
            } else {
                customColor = target.connectionColor;
                customWidth = target.connectionWidth;
                customDashArray = target.connectionDashArray;
            }

            // Create dynamic marker for custom colors
            let markerId;
            if (isSelected) {
                markerId = 'arrow-selected';
            } else if (customColor) {
                // Create a unique marker ID for this color
                const colorId = customColor.replace('#', '');
                markerId = `arrow-${colorId}`;

                // Check if marker already exists, if not create it
                const svg = document.querySelector('svg defs');
                if (!document.getElementById(markerId)) {
                    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                    marker.setAttribute('id', markerId);
                    marker.setAttribute('viewBox', '0 0 10 10');
                    marker.setAttribute('refX', '10');
                    marker.setAttribute('refY', '5');
                    marker.setAttribute('markerWidth', '8');
                    marker.setAttribute('markerHeight', '8');
                    marker.setAttribute('orient', 'auto');

                    const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    markerPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
                    markerPath.setAttribute('fill', customColor);

                    marker.appendChild(markerPath);
                    svg.appendChild(marker);
                }
            } else if (isRelation) {
                markerId = 'arrow-relation';
            } else {
                markerId = 'arrow';
            }

            path.setAttribute('marker-end', `url(#${markerId})`);

            // Apply stroke styles
            if (customColor) path.style.stroke = customColor;
            else if (isRelation) path.style.stroke = '#a78bfa';

            if (customWidth) path.style.strokeWidth = `${customWidth}px`;
            else if (isRelation) path.style.strokeWidth = '2px';

            // Apply dash array - custom takes priority, then relation default
            if (customDashArray !== null && customDashArray !== undefined) {
                path.style.strokeDasharray = customDashArray;
            } else if (isRelation) {
                path.style.strokeDasharray = '5,5';
            }

            // Store custom properties as data attributes for PDF export
            if (customColor) path.dataset.customColor = customColor;
            if (customWidth) path.dataset.customWidth = customWidth;

            const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitPath.setAttribute('d', d);
            hitPath.setAttribute('fill', 'none');
            hitPath.setAttribute('stroke', 'transparent');
            hitPath.setAttribute('stroke-width', '15');
            hitPath.style.cursor = 'pointer';
            hitPath.style.pointerEvents = 'stroke';

            hitPath.addEventListener('mousedown', (e) => {
                e.preventDefault(); e.stopPropagation();
                hideContextMenu();
                mindMapState.selectedConnection = { sourceId: source.id, targetId: target.id };
                render();
            });

            if (isRelation) {

            }

            const handleX = (pX + 3 * c1x + 3 * c2x + cX) / 8;
            const handleY = (pY + 3 * c1y + 3 * c2y + cY) / 8;

            const handleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            handleGroup.setAttribute('class', isSelected ? 'connection-handle-group selected' : 'connection-handle-group');
            handleGroup.setAttribute('transform', `translate(${handleX}, ${handleY})`);
            handleGroup.dataset.source = source.id;
            handleGroup.dataset.target = target.id;
            handleGroup.setAttribute('title', 'Drag to adjust curve');

            const handleBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            handleBg.setAttribute('r', '8');
            handleBg.setAttribute('class', 'connection-handle-bg');

            const plus = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            plus.setAttribute('d', 'M -4 0 L 4 0 M 0 -4 L 0 4');
            plus.setAttribute('class', 'connection-handle-icon');
            plus.setAttribute('fill', 'none');
            plus.setAttribute('stroke', '#64748b');
            plus.setAttribute('stroke-width', '1.5');
            plus.setAttribute('stroke-linecap', 'round');

            handleGroup.appendChild(handleBg);
            handleGroup.appendChild(plus);

            // Render Label if exists (centered on handle)
            if (labelText) {
                const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                // Offset a bit so it doesn't overlap the plus handle too much
                textGroup.setAttribute('transform', `translate(0, -15)`);

                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');

                textEl.textContent = labelText;
                textEl.setAttribute('fill', '#000'); // Always black text for visibility
                textEl.setAttribute('font-size', '11');
                textEl.setAttribute('text-anchor', 'middle');
                textEl.setAttribute('dy', '4'); // vertical centerish

                // We can't easily measure text width in SVG without rendering.
                // Approximate width: 6px per char
                const approxWidth = labelText.length * 7 + 10;
                bgRect.setAttribute('width', approxWidth);
                bgRect.setAttribute('height', '16');
                bgRect.setAttribute('x', -approxWidth / 2);
                bgRect.setAttribute('y', -8);
                bgRect.setAttribute('rx', '4');
                bgRect.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
                bgRect.setAttribute('stroke', '#cbd5e1');

                textGroup.appendChild(bgRect);
                textGroup.appendChild(textEl);
                handleGroup.appendChild(textGroup);
            }

            handleGroup.addEventListener('mousedown', (e) => {
                if (e.button === 0) {
                    e.stopPropagation();
                    hideContextMenu();
                    mindMapState.archDrag.active = true;
                    mindMapState.archDrag.dragged = false;
                    mindMapState.archDrag.sourceId = source.id;
                    mindMapState.archDrag.targetId = target.id;
                    mindMapState.archDrag.isRelation = isRelation;
                    mindMapState.archDrag.startX = e.clientX;
                    mindMapState.archDrag.startY = e.clientY;

                    // Cache elements to prevent lag from querySelector in mousemove
                    mindMapState.archDrag.cachedPath = targetGroup.querySelector(`path.connection[data-source="${source.id}"][data-target="${target.id}"]`);
                    mindMapState.archDrag.cachedHandleGroup = handleGroup;

                    // Cache start values
                    mindMapState.archDrag.startArchWidth = customArchWidth !== null ? customArchWidth : (isSelfLoop ? 150 : 70);
                    if (colStep > 0 && !isSelfLoop) mindMapState.archDrag.startArchWidth = customArchWidth !== null ? customArchWidth : 60;

                    mindMapState.archDrag.startArchHeight = customArchHeight !== null ? customArchHeight : (isSelfLoop ? 100 : 60);
                    if (colStep > 0 && !isSelfLoop) mindMapState.archDrag.startArchHeight = customArchHeight !== null ? customArchHeight : (80 + (absStep > 1 ? (absStep - 1) * 30 : 0));

                    canvasContainer.style.cursor = 'move';
                }
            });

            handleGroup.onclick = (e) => {
                if (!mindMapState.archDrag.active && !mindMapState.archDrag.dragged) {
                    e.stopPropagation();
                    insertIntermediateNode(source.id, target.id, isRelation);
                }
            };

            const onContextMenu = (e) => {
                e.preventDefault(); e.stopPropagation();

                const menu = document.createElement('div');
                menu.style.position = 'fixed';
                menu.style.left = `${e.clientX}px`;
                menu.style.top = `${e.clientY}px`;
                menu.style.background = '#1e293b';
                menu.style.border = '1px solid #334155';
                menu.style.borderRadius = '6px';
                menu.style.padding = '8px';
                menu.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
                menu.style.zIndex = '9999';
                menu.style.minWidth = '200px';

                const itemStyle = 'padding: 8px 12px; cursor: pointer; font-size: 14px; user-select: none; color: #f8fafc; transition: background 0.15s;';
                const hoverBg = '#334155';
                const sectionTitleStyle = 'padding: 4px 12px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;';

                const createItem = (text, onClick, isDestructive = false) => {
                    const item = document.createElement('div');
                    item.innerText = text;
                    item.style.cssText = itemStyle;
                    if (isDestructive) item.style.color = '#ef4444';
                    item.onmouseover = () => item.style.backgroundColor = hoverBg;
                    item.onmouseout = () => item.style.backgroundColor = 'transparent';
                    item.onclick = (ev) => {
                        ev.stopPropagation();
                        menu.remove();
                        document.removeEventListener('mousedown', closeMenu);
                        onClick();
                    };
                    return item;
                };

                // Edit Label
                menu.appendChild(createItem('Edit Label', () => {
                    const currentLabel = isRelation
                        ? (typeof source.relations[index] === 'object' ? source.relations[index].label : '')
                        : (target.connectionLabel || '');

                    setTimeout(() => {
                        const newLabel = prompt('Connection Label:', currentLabel);
                        if (newLabel !== null) {
                            updateConnectionLabel(source.id, target.id, isRelation, newLabel);
                        }
                    }, 10);
                }));

                // Color Section
                const colorTitle = document.createElement('div');
                colorTitle.innerText = 'Color';
                colorTitle.style.cssText = sectionTitleStyle;
                colorTitle.style.marginTop = '8px';
                menu.appendChild(colorTitle);

                const colorGrid = document.createElement('div');
                colorGrid.style.display = 'grid';
                colorGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
                colorGrid.style.gap = '6px';
                colorGrid.style.padding = '8px 12px';

                const colors = ['#64748b', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
                colors.forEach(color => {
                    const swatch = document.createElement('div');
                    swatch.style.width = '24px';
                    swatch.style.height = '24px';
                    swatch.style.borderRadius = '4px';
                    swatch.style.backgroundColor = color;
                    swatch.style.cursor = 'pointer';
                    swatch.style.border = '2px solid rgba(255,255,255,0.1)';
                    swatch.style.transition = 'all 0.2s';
                    swatch.onmouseover = () => {
                        swatch.style.transform = 'scale(1.15)';
                        swatch.style.borderColor = 'white';
                    };
                    swatch.onmouseout = () => {
                        swatch.style.transform = 'scale(1)';
                        swatch.style.borderColor = 'rgba(255,255,255,0.1)';
                    };
                    swatch.onclick = (ev) => {
                        ev.stopPropagation();
                        menu.remove();
                        document.removeEventListener('mousedown', closeMenu, true);
                        updateConnectionColor(source.id, target.id, isRelation, color);
                    };
                    colorGrid.appendChild(swatch);
                });
                menu.appendChild(colorGrid);

                // Stroke Width Section
                const widthTitle = document.createElement('div');
                widthTitle.innerText = 'Stroke Width';
                widthTitle.style.cssText = sectionTitleStyle;
                widthTitle.style.marginTop = '4px';
                menu.appendChild(widthTitle);

                const widthGrid = document.createElement('div');
                widthGrid.style.display = 'grid';
                widthGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
                widthGrid.style.gap = '6px';
                widthGrid.style.padding = '8px 12px';

                const widths = [1, 2, 3, 4];
                widths.forEach(width => {
                    const widthBtn = document.createElement('div');
                    widthBtn.innerText = `${width}px`;
                    widthBtn.style.cssText = itemStyle;
                    widthBtn.style.textAlign = 'center';
                    widthBtn.style.padding = '6px';
                    widthBtn.style.fontSize = '12px';
                    widthBtn.style.borderRadius = '4px';
                    widthBtn.onmouseover = () => widthBtn.style.backgroundColor = hoverBg;
                    widthBtn.onmouseout = () => widthBtn.style.backgroundColor = 'transparent';
                    widthBtn.onclick = (ev) => {
                        ev.stopPropagation();
                        menu.remove();
                        document.removeEventListener('mousedown', closeMenu, true);
                        updateConnectionWidth(source.id, target.id, isRelation, width);
                    };
                    widthGrid.appendChild(widthBtn);
                });
                menu.appendChild(widthGrid);

                // Line Style Section
                const styleTitle = document.createElement('div');
                styleTitle.innerText = 'Line Style';
                styleTitle.style.cssText = sectionTitleStyle;
                styleTitle.style.marginTop = '4px';
                menu.appendChild(styleTitle);

                const styleGrid = document.createElement('div');
                styleGrid.style.display = 'grid';
                styleGrid.style.gridTemplateColumns = '1fr';
                styleGrid.style.gap = '4px';
                styleGrid.style.padding = '8px 12px';

                const lineStyles = [
                    { name: 'Solid', value: 'none', preview: '━━━━━━━' },
                    { name: 'Dashed', value: '8,4', preview: '━━ ━━ ━━' },
                    { name: 'Dotted', value: '2,3', preview: '・・・・・・・' },
                    { name: 'Dash-Dot', value: '8,3,2,3', preview: '━━・━━・' }
                ];

                lineStyles.forEach(style => {
                    const styleBtn = document.createElement('div');
                    styleBtn.style.cssText = itemStyle;
                    styleBtn.style.padding = '6px 12px';
                    styleBtn.style.fontSize = '12px';
                    styleBtn.style.borderRadius = '4px';
                    styleBtn.style.display = 'flex';
                    styleBtn.style.justifyContent = 'space-between';
                    styleBtn.style.alignItems = 'center';

                    const nameSpan = document.createElement('span');
                    nameSpan.innerText = style.name;

                    const previewSpan = document.createElement('span');
                    previewSpan.innerText = style.preview;
                    previewSpan.style.fontFamily = 'monospace';
                    previewSpan.style.color = '#94a3b8';
                    previewSpan.style.fontSize = '14px';

                    styleBtn.appendChild(nameSpan);
                    styleBtn.appendChild(previewSpan);

                    styleBtn.onmouseover = () => styleBtn.style.backgroundColor = hoverBg;
                    styleBtn.onmouseout = () => styleBtn.style.backgroundColor = 'transparent';
                    styleBtn.onclick = (ev) => {
                        ev.stopPropagation();
                        menu.remove();
                        document.removeEventListener('mousedown', closeMenu, true);
                        updateConnectionStyle(source.id, target.id, isRelation, style.value);
                    };
                    styleGrid.appendChild(styleBtn);
                });
                menu.appendChild(styleGrid);

                // Separator
                const separator = document.createElement('div');
                separator.style.height = '1px';
                separator.style.background = '#334155';
                separator.style.margin = '8px 0';
                menu.appendChild(separator);

                // Delete Connection (Only for relations/dashed arrows)
                if (isRelation) {
                    menu.appendChild(createItem('Delete Connection', () => {
                        deleteConnection(source.id, target.id);
                    }, true));
                }

                const closeMenu = (ev) => {
                    if (!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener('mousedown', closeMenu, true);
                    }
                };
                document.body.appendChild(menu);
                setTimeout(() => document.addEventListener('mousedown', closeMenu, true), 0);
            };

            handleGroup.oncontextmenu = onContextMenu;
            hitPath.oncontextmenu = onContextMenu;

            targetGroup.appendChild(hitPath);
            targetGroup.appendChild(path);
            targetGroup.appendChild(handleGroup);
        }
    }

    // Interaction
    function selectNode(id) {
        if (mindMapState.selectedNodeId === id) return;

        // Remove class from previous
        if (mindMapState.selectedNodeId) {
            const prevEl = nodesLayer.querySelector(`[data-id="${mindMapState.selectedNodeId}"]`);
            if (prevEl) prevEl.classList.remove('selected');
        }

        mindMapState.selectedNodeId = id;

        // Add class to new
        if (mindMapState.selectedNodeId) {
            const nextEl = nodesLayer.querySelector(`[data-id="${mindMapState.selectedNodeId}"]`);
            if (nextEl) nextEl.classList.add('selected');
        }

        // No full render() needed
    }

    function enterEditMode(id) {
        const el = nodesLayer.querySelector(`[data-id="${id}"]`);
        if (!el) return;

        const currentText = findNode(id).text;
        el.innerHTML = '';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'node-input';
        input.value = currentText;

        input.onblur = () => saveEdit(id, input.value);
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
            e.stopPropagation(); // Prevent triggering shortcuts
        };

        el.appendChild(input);

        // Vertical resize handle (shown only in text mode)
        const resizerY = document.createElement('div');
        resizerY.className = 'resize-handle vertical';
        resizerY.title = 'Drag to resize node height';
        resizerY.onmousedown = (e) => {
            e.preventDefault(); e.stopPropagation();
            mindMapState.nodeResize.active = true;
            mindMapState.nodeResize.nodeId = id;
            mindMapState.nodeResize.axis = 'v';
            mindMapState.nodeResize.startY = e.clientY;
            mindMapState.nodeResize.startSize = el.offsetHeight;
            canvasContainer.style.cursor = 'ns-resize';
        };
        el.appendChild(resizerY);

        // Horizontal resize handle (shown only in text mode)
        const resizerX = document.createElement('div');
        resizerX.className = 'resize-handle horizontal';
        resizerX.title = 'Drag to resize node width';
        resizerX.onmousedown = (e) => {
            e.preventDefault(); e.stopPropagation();
            mindMapState.nodeResize.active = true;
            mindMapState.nodeResize.nodeId = id;
            mindMapState.nodeResize.axis = 'h';
            mindMapState.nodeResize.startX = e.clientX;
            mindMapState.nodeResize.startSize = el.offsetWidth;
            canvasContainer.style.cursor = 'ew-resize';
        };
        el.appendChild(resizerX);

        input.focus();
        input.select();
    }

    function saveEdit(id, text) {
        if (text.trim() === '') text = 'Node';
        updateNodeText(id, text);
        render();
    }

    // Toast Notification
    function showToast(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        // Add icon based on type
        const icon = type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-info-circle"></i>';
        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function setupEventListeners() {
        if (!isEventListenersAdded) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
            window.addEventListener('resize', () => {
                setViewportHeight();
            });
            window.addEventListener('orientationchange', () => {
                setTimeout(setViewportHeight, 100);
            });
            isEventListenersAdded = true;
        }

        // Per-container interaction
        if (canvasContainer) {
            canvasContainer.onmousedown = (e) => {
                if (!e.target.closest('.connection-handle-group') && !e.target.closest('.node')) {
                    if (mindMapState.selectedConnection) {
                        mindMapState.selectedConnection = null;
                        render();
                    }
                }
                if (e.target.closest('.node')) return;

                mindMapState.isDragging = true;
                mindMapState.lastMousePos = { x: e.clientX, y: e.clientY };
                canvasContainer.style.cursor = 'grabbing';
                hideContextMenu();
            };

            canvasContainer.onwheel = (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                zoom(delta);
            };

            setupTouchEvents();
        }
    }

    function setupKeyboardShortcuts() {
        if (isKeyboardShortcutsAdded) return;
        isKeyboardShortcutsAdded = true;
        document.addEventListener('keydown', handleGlobalKeyDown);
    }

    function handleGlobalKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;

        switch (e.key) {
            case 'Tab':
                e.preventDefault();
                if (mindMapState.selectedNodeId) addNode(mindMapState.selectedNodeId);
                break;
            case 'Enter':
                e.preventDefault();
                if (mindMapState.selectedNodeId) {
                    if (mindMapState.selectedNodeId === mindMapState.root.id) {
                        addNode(mindMapState.selectedNodeId);
                    } else {
                        addSibling(mindMapState.selectedNodeId);
                    }
                }
                break;
            case 'Delete':
            case 'Backspace':
                if (mindMapState.selectedNodeId) {
                    if (mindMapState.selectedNodeId !== mindMapState.root.id) {
                        deleteNode(mindMapState.selectedNodeId);
                    }
                } else if (mindMapState.selectedImageId) {
                    deleteImage(mindMapState.selectedImageId);
                }
                break;
            case 'ArrowUp':
                if (e.altKey && mindMapState.selectedNodeId) {
                    e.preventDefault();
                    moveNodeUp(mindMapState.selectedNodeId);
                }
                break;
            case 'ArrowDown':
                if (e.altKey && mindMapState.selectedNodeId) {
                    e.preventDefault();
                    moveNodeDown(mindMapState.selectedNodeId);
                }
                break;
        }
    }

    function handleGlobalMouseMove(e) {
        if (!canvasContainer) return;

        if (mindMapState.archDrag.active) handleArchDragMouseMove(e);
        else if (mindMapState.connectionDrag.active) handleConnectionDragMouseMove(e);
        else if (mindMapState.potentialDragNodeId && !mindMapState.isNodeDragging) handlePotentialNodeDragMouseMove(e);
        else if (mindMapState.isNodeDragging) handleNodeDragMouseMove(e);
        else if (mindMapState.imageDrag.active) handleImageDragMouseMove(e);
        else if (mindMapState.imageResize.active) handleImageResizeMouseMove(e);
        else if (mindMapState.isDragging) handleCanvasPanMouseMove(e);
        else if (mindMapState.nodeResize.active) handleNodeResizeMouseMove(e);
    }

    function handleArchDragMouseMove(e) {
        const source = findNode(mindMapState.archDrag.sourceId);
        const target = findNode(mindMapState.archDrag.targetId);
        if (!source || !target) return;

        if (!mindMapState.archDrag.dragged) {
            if (Math.hypot(e.clientX - mindMapState.archDrag.startX, e.clientY - mindMapState.archDrag.startY) > 5) mindMapState.archDrag.dragged = true;
        }

        const rect = canvasContainer.getBoundingClientRect();
        const worldMouseX = (e.clientX - rect.left - mindMapState.pan.x) / mindMapState.scale;
        const worldMouseY = (e.clientY - rect.top - mindMapState.pan.y) / mindMapState.scale;
        const startWorldX = (mindMapState.archDrag.startX - rect.left - mindMapState.pan.x) / mindMapState.scale;

        const pEl = nodesLayer.querySelector(`[data-id="${source.id}"]`);
        if (!pEl) return;
        const pWidth = pEl.offsetWidth;
        const isSelfLoop = (source.id === target.id);

        let pX = source.x + pWidth, pY = source.y;
        let cX = target.x - 4, cY = target.y;

        if (mindMapState.archDrag.isRelation) {
            const idx = (source.relations || []).findIndex(r => (typeof r === 'string' ? r === target.id : r.id === target.id));
            if (idx !== -1) { pY += 6 + (idx * 6); cY += 6; }
        }
        if (isSelfLoop) {
            const nodeH = pEl.offsetHeight;
            pY = source.y - nodeH * 0.4; cY = source.y + nodeH * 0.4;
            pX = source.x + pWidth; cX = source.x - 4;
        }

        let newW = mindMapState.archDrag.startArchWidth + (worldMouseX - startWorldX);
        const signedH = (8 * worldMouseY - 4 * pY - 4 * cY) / 6;
        const newH = Math.abs(signedH);
        const isNowUp = (signedH < 0);

        if (mindMapState.archDrag.isRelation) {
            const rel = (source.relations || []).find(r => (typeof r === 'string' ? r === target.id : r.id === target.id));
            if (rel && typeof rel === 'object') {
                rel.arch = isNowUp ? 'up' : 'down';
                rel.archWidth = newW; rel.archHeight = newH;
            }
        } else {
            target.archPreference = isNowUp ? 'up' : 'down';
            target.customArchWidth = newW; target.customArchHeight = newH;
        }

        const path = mindMapState.archDrag.cachedPath;
        const hGroup = mindMapState.archDrag.cachedHandleGroup;
        if (path || hGroup) {
            const c1x = pX + newW, c2x = cX - newW;
            const c1y = pY + signedH, c2y = cY + signedH;
            const d = `M ${pX} ${pY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${cX} ${cY}`;
            if (path) path.setAttribute('d', d);
            const hx = (pX + 3 * c1x + 3 * c2x + cX) / 8, hy = (pY + 3 * c1y + 3 * c2y + cY) / 8;
            if (hGroup) hGroup.setAttribute('transform', `translate(${hx}, ${hy})`);
        }
    }

    function handleConnectionDragMouseMove(e) {
        mindMapState.connectionDrag.currentPos = { x: e.clientX, y: e.clientY };
        const nodes = document.elementsFromPoint(e.clientX, e.clientY);
        const targetEl = nodes.find(el => el.classList.contains('node'));
        const newTargetId = targetEl ? targetEl.dataset.id : null;

        if (mindMapState.dropTargetId !== newTargetId) {
            if (mindMapState.dropTargetId) {
                const oldEl = nodesLayer.querySelector(`[data-id="${mindMapState.dropTargetId}"]`);
                if (oldEl) oldEl.classList.remove('drop-target');
            }
            mindMapState.dropTargetId = newTargetId;
            if (mindMapState.dropTargetId) {
                const newEl = nodesLayer.querySelector(`[data-id="${mindMapState.dropTargetId}"]`);
                if (newEl) newEl.classList.add('drop-target');
            }
        }
        updateDragLine();
    }

    function handlePotentialNodeDragMouseMove(e) {
        const dx = e.clientX - mindMapState.dragStartPos.x;
        const dy = e.clientY - mindMapState.dragStartPos.y;
        if (Math.hypot(dx, dy) > 5) {
            if (mindMapState.potentialDragNodeId !== mindMapState.root.id) {
                mindMapState.isNodeDragging = true;
                mindMapState.draggedNodeId = mindMapState.potentialDragNodeId;
                canvasContainer.style.cursor = 'move';
                render();
            } else {
                mindMapState.potentialDragNodeId = null;
            }
        }
    }

    function handleNodeDragMouseMove(e) {
        const nodes = document.elementsFromPoint(e.clientX, e.clientY);
        const targetEl = nodes.find(el => el.classList.contains('node') && el.dataset.id !== mindMapState.draggedNodeId);
        const newTargetId = targetEl ? targetEl.dataset.id : null;

        let newTargetType = 'parent', newTargetIndex = -1;
        if (newTargetId) {
            const draggedParent = findParent(mindMapState.draggedNodeId);
            const targetParent = findParent(newTargetId);
            if (draggedParent && targetParent && draggedParent.id === targetParent.id) {
                newTargetType = 'sibling';
                const rect = targetEl.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const targetIdx = targetParent.children.findIndex(c => c.id === newTargetId);
                newTargetIndex = (e.clientY < midY) ? targetIdx : targetIdx + 1;
            }
        }

        if (mindMapState.dropTargetId !== newTargetId || mindMapState.dropTargetIndex !== newTargetIndex) {
            mindMapState.dropTargetId = newTargetId;
            mindMapState.dropTargetType = newTargetType;
            mindMapState.dropTargetIndex = newTargetIndex;
            render();
        }
    }

    function handleImageDragMouseMove(e) {
        const dx = e.clientX - mindMapState.imageDrag.lastX;
        const dy = e.clientY - mindMapState.imageDrag.lastY;
        const img = mindMapState.images.find(img => img.id === mindMapState.imageDrag.id);
        if (img) {
            img.x += dx / mindMapState.scale;
            img.y += dy / mindMapState.scale;
            mindMapState.imageDrag.lastX = e.clientX;
            mindMapState.imageDrag.lastY = e.clientY;
            renderImages();
        }
    }

    function handleImageResizeMouseMove(e) {
        const idx = mindMapState.images.findIndex(img => img.id === mindMapState.imageResize.id);
        if (idx !== -1) {
            const dx = e.clientX - mindMapState.imageResize.startX;
            const dy = e.clientY - mindMapState.imageResize.startY;
            mindMapState.images[idx].width = Math.max(50, mindMapState.imageResize.startW + (dx / mindMapState.scale));
            mindMapState.images[idx].height = Math.max(50, mindMapState.imageResize.startH + (dy / mindMapState.scale));
            renderImages();
        }
    }

    function handleCanvasPanMouseMove(e) {
        const dx = e.clientX - mindMapState.lastMousePos.x;
        const dy = e.clientY - mindMapState.lastMousePos.y;
        mindMapState.pan.x += dx;
        mindMapState.pan.y += dy;
        mindMapState.lastMousePos = { x: e.clientX, y: e.clientY };
        updateView();
    }

    function handleNodeResizeMouseMove(e) {
        const node = findNode(mindMapState.nodeResize.nodeId);
        if (!node) return;
        if (mindMapState.nodeResize.axis === 'v') {
            const dy = e.clientY - mindMapState.nodeResize.startY;
            node.customHeight = Math.max(CONFIG.nodeHeight, mindMapState.nodeResize.startSize + (dy / mindMapState.scale));
        } else {
            const dx = e.clientX - mindMapState.nodeResize.startX;
            node.customWidth = Math.max(CONFIG.nodeWidth, mindMapState.nodeResize.startSize + (dx / mindMapState.scale));
        }
        render();
    }

    function handleGlobalMouseUp(e) {
        if (mindMapState.nodeResize.active) {
            mindMapState.nodeResize.active = false;
            if (canvasContainer) canvasContainer.style.cursor = 'grab';
            return;
        }

        if (mindMapState.imageDrag.active || mindMapState.imageResize.active) {
            mindMapState.imageDrag.active = false; mindMapState.imageResize.active = false;
            persistState(); return;
        }

        if (mindMapState.archDrag.active) {
            mindMapState.archDrag.active = false;
            setTimeout(() => { mindMapState.archDrag.dragged = false; }, 200);
            if (canvasContainer) canvasContainer.style.cursor = 'grab';
            return;
        }

        if (mindMapState.connectionDrag.active) {
            handleConnectionDragEnd(e);
            return;
        }

        if (mindMapState.isNodeDragging) {
            handleNodeDragEnd(e);
            return;
        }

        if (mindMapState.potentialDragNodeId) {
            selectNode(mindMapState.potentialDragNodeId);
            mindMapState.potentialDragNodeId = null;
        }

        mindMapState.isDragging = false;
        if (canvasContainer) canvasContainer.style.cursor = 'grab';
        persistState();
    }

    function handleConnectionDragEnd(e) {
        const sourceId = mindMapState.connectionDrag.sourceNodeId;
        const targetId = mindMapState.dropTargetId;
        const type = mindMapState.connectionDrag.type;

        if (canvasContainer) canvasContainer.classList.remove('dragging-in', 'dragging-out');
        const dragLine = document.getElementById('drag-line');
        if (dragLine) dragLine.remove();

        if (mindMapState.dropTargetId) {
            const el = nodesLayer.querySelector(`[data-id="${mindMapState.dropTargetId}"]`);
            if (el) el.classList.remove('drop-target');
        }

        mindMapState.connectionDrag.active = false;

        if (targetId) {
            if (type === 'out') {
                const sourceNode = findNode(sourceId);
                const rect = canvasContainer ? canvasContainer.getBoundingClientRect() : { top: 0, left: 0 };
                const worldY = (e.clientY - rect.top - mindMapState.pan.y) / mindMapState.scale;
                let archChoice = 'auto';
                if (sourceNode) {
                    const dy = worldY - sourceNode.y;
                    if (dy < -30) archChoice = 'up';
                    else if (dy > 30) archChoice = 'down';
                }
                toggleRelation(sourceId, targetId, archChoice);
            } else if (sourceId !== targetId) {
                moveNodeTo(sourceId, targetId);
            }
        } else if (type === 'out') {
            addNode(sourceId);
            showToast('New node created.');
        }

        mindMapState.connectionDrag.sourceNodeId = null;
        mindMapState.dropTargetId = null;
        render();
    }

    function handleNodeDragEnd(e) {
        if (mindMapState.draggedNodeId && mindMapState.dropTargetId) {
            if (mindMapState.dropTargetType === 'sibling') {
                saveState();
                const parent = findParent(mindMapState.draggedNodeId);
                const oldIdx = parent.children.findIndex(c => c.id === mindMapState.draggedNodeId);
                const nodeRecord = parent.children.splice(oldIdx, 1)[0];
                let newIdx = mindMapState.dropTargetIndex;
                if (oldIdx < newIdx) newIdx--;
                parent.children.splice(newIdx, 0, nodeRecord);
                updateLayout();
            } else if (e.shiftKey) {
                toggleRelation(mindMapState.draggedNodeId, mindMapState.dropTargetId);
            } else {
                moveNodeTo(mindMapState.draggedNodeId, mindMapState.dropTargetId);
            }
        }
        mindMapState.isNodeDragging = false;
        mindMapState.draggedNodeId = null; mindMapState.dropTargetId = null;
        mindMapState.dropTargetType = null; mindMapState.dropTargetIndex = -1;
        mindMapState.potentialDragNodeId = null;
        render();
    }

    function zoom(factor) {
        const newScale = mindMapState.scale * factor;
        if (newScale > 0.1 && newScale < 5) {
            mindMapState.scale = newScale;
            updateView(); // Efficient view update only
            persistState(); // Save zoom level
        }
    }

    function centerView() {
        if (!canvasContainer) return;
        const width = canvasContainer.offsetWidth || 800;
        const height = canvasContainer.offsetHeight || 600;
        mindMapState.pan.x = width / 4;
        mindMapState.pan.y = height / 2;
        mindMapState.scale = 1;
        updateView();
    }

    // Print & View Management
    function fitToScreen(forPrint = false) {
        if (!canvasContainer && !forPrint) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const padding = 50;

        // Calculate bounding box of all nodes
        function traverseNodes(node) {
            const el = nodesLayer ? nodesLayer.querySelector(`[data-id="${node.id}"]`) : null;
            const w = el ? el.offsetWidth : CONFIG.nodeWidth;
            const h = el ? el.offsetHeight : 40;

            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y - h / 2);
            maxX = Math.max(maxX, node.x + w);
            maxY = Math.max(maxY, node.y + h / 2);
            node.children.forEach(traverseNodes);
        }
        traverseNodes(mindMapState.root);

        // Include images in bounding box calculation
        mindMapState.images.forEach(img => {
            minX = Math.min(minX, img.x);
            minY = Math.min(minY, img.y);
            maxX = Math.max(maxX, img.x + img.width);
            maxY = Math.max(maxY, img.y + img.height);
        });

        if (minX === Infinity) { // No nodes or images
            console.log('MindMapModule: fitToScreen - No content to center.');
            centerView(); // Fallback to center view
            return;
        }

        const contentWidth = maxX - minX + (padding * 2);
        const contentHeight = maxY - minY + (padding * 2);

        let targetWidth, targetHeight;
        if (canvasContainer) {
            targetWidth = canvasContainer.offsetWidth;
            targetHeight = canvasContainer.offsetHeight;
        } else {
            targetWidth = window.innerWidth;
            targetHeight = window.innerHeight;
        }

        // If target dimensions are 0 (hidden container), use defaults to avoid NaN
        if (targetWidth <= 0) targetWidth = isEmbedded ? 800 : window.innerWidth;
        if (targetHeight <= 0) targetHeight = isEmbedded ? 480 : window.innerHeight;

        const scaleX = targetWidth / contentWidth;
        const scaleY = targetHeight / contentHeight;
        let scale = Math.min(scaleX, scaleY);

        // Clamp scale — more aggressive limit for embedded to prevent huge nodes
        const maxScale = isEmbedded ? 1.0 : 1.2;
        const minScale = 0.1;
        scale = Math.max(minScale, Math.min(maxScale, scale));

        mindMapState.scale = scale;
        mindMapState.pan.x = (targetWidth / 2) - ((minX + maxX) / 2) * scale;
        mindMapState.pan.y = (targetHeight / 2) - ((minY + maxY) / 2) * scale;

        updateView();
        if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(mindMapState.scale * 100)}%`;
    }

    // Print Events
    // Print Events - Handled manually in button click for better mobile support
    // window.onbeforeprint / onafterprint removed

    // IO
    // IO
    function saveMap() {
        const saveData = {
            version: 1,
            root: mindMapState.root,
            images: mindMapState.images,
            columnLabels: mindMapState.columnLabels || {},
            pan: mindMapState.pan,
            scale: mindMapState.scale
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saveData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "mindmap.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast('Map saved to file');
    }

    function loadMap(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loaded = JSON.parse(e.target.result);

                // Backward compatibility
                if (loaded.root && loaded.version) {
                    mindMapState.root = loaded.root;
                    mindMapState.images = loaded.images || [];
                    mindMapState.columnLabels = loaded.columnLabels || {};

                    // Restore view mindMapState if available
                    if (loaded.pan) {
                        mindMapState.pan = loaded.pan;
                    }
                    if (loaded.scale) {
                        mindMapState.scale = loaded.scale;
                    }
                } else if (loaded.id) {
                    // Should be old format (just root node)
                    mindMapState.root = loaded;
                    mindMapState.images = [];
                    mindMapState.columnLabels = {};
                } else {
                    throw new Error('Unknown format');
                }

                // Normalize Data: Ensure all relations are objects and structures are valid
                normalizeData(mindMapState.root);

                // Re-init undo stack
                mindMapState.history = [];
                mindMapState.future = [];

                // Initial save to establish baseline? No, waiting for first action.
                updateUndoRedoButtons();

                updateLayout();
                render();
                persistState(); // Save loaded mindMapState to localStorage
                showToast('Map loaded.');
            } catch (error) {
                console.error(error);
                showToast('Invalid file format: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset
    }

    function normalizeData(node) {
        if (!node) return;
        if (!node.children) node.children = [];
        if (!node.relations) node.relations = [];

        // Normalize relations to objects
        node.relations = node.relations.map(rel => {
            if (typeof rel === 'string') {
                return { id: rel, arch: 'auto', label: '' };
            }
            // Ensure properties exist
            if (!rel.label) rel.label = '';
            if (!rel.arch) rel.arch = 'auto';
            return rel;
        });

        node.children.forEach(normalizeData);
    }

    // Separate function to update drag line efficiently
    function updateDragLine() {
        const sourceNode = findNode(mindMapState.connectionDrag.sourceNodeId);
        if (!sourceNode) return;

        let dragPath = document.getElementById('drag-line');
        if (!dragPath) {
            // Create it in the SVG group
            const g = connectionsLayer.querySelector('g');
            if (g) {
                dragPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                dragPath.id = 'drag-line';
                dragPath.setAttribute('class', 'connection drag');
                dragPath.setAttribute('stroke', '#fbbf24');
                dragPath.setAttribute('stroke-width', '2');
                dragPath.setAttribute('stroke-dasharray', '5,5');
                dragPath.setAttribute('fill', 'none');
                dragPath.setAttribute('marker-end', 'url(#arrow-drag)');
                g.appendChild(dragPath);
            } else {
                return;
            }
        }

        // Start Point
        let startX = sourceNode.x;
        let startY = sourceNode.y;

        // Check DOM for width/offset
        const el = nodesLayer.querySelector(`[data-id="${sourceNode.id}"]`);
        if (el) {
            const offset = 6;
            startX = mindMapState.connectionDrag.type === 'out'
                ? sourceNode.x + el.offsetWidth + offset
                : sourceNode.x - offset;
        }

        // End Point
        const rect = canvasContainer.getBoundingClientRect();
        const mouseRelX = mindMapState.connectionDrag.currentPos.x - rect.left;
        const mouseRelY = mindMapState.connectionDrag.currentPos.y - rect.top;

        const worldMouseX = (mouseRelX - mindMapState.pan.x) / mindMapState.scale;
        const worldMouseY = (mouseRelY - mindMapState.pan.y) / mindMapState.scale;

        // Use shared routing logic for preview
        let c1x = startX + (worldMouseX - startX) / 2;
        let c1y = startY;
        let c2x = worldMouseX - (worldMouseX - startX) / 2;
        let c2y = worldMouseY;

        // Smart Preview Routing:
        // Tighten the threshold: only consider as "Generation 1" if mouse is 
        // reasonably far in the X direction but not yet into Generation 2.
        const relativeX = worldMouseX - startX;
        const colStepApprox = Math.round(relativeX / CONFIG.gapX);

        // We also check if it's within a "Bezier window" (e.g., 0.6x to 1.4x the gap)
        // AND if it's vertically close to the start point.
        const isInBezierWindow = relativeX > CONFIG.gapX * 0.6 &&
            relativeX < CONFIG.gapX * 1.4 &&
            Math.abs(worldMouseY - startY) < 50;

        if (!isInBezierWindow) {
            if (colStepApprox <= 0 || (isInBezierWindow && Math.abs(worldMouseY - startY) >= 50)) {
                // ... (rest is handled by the arch logic below)
            }

            if (colStepApprox <= 0) {
                // Same column or Backward preview
                const curveWidth = 70;
                c1x = startX + curveWidth;
                c2x = worldMouseX + curveWidth;
                c1y = startY;
                c2y = worldMouseY;
            } else {
                // Forward jump or Forced Arch via vertical pull
                const absStep = Math.max(1, colStepApprox);
                // More aggressive arch for skips
                const archHeight = 80 + (absStep > 1 ? (absStep - 1) * 30 : 0);

                if (worldMouseY <= startY) {
                    // Arch UP
                    const topY = Math.min(startY, worldMouseY) - archHeight;
                    c1y = topY; c2y = topY;
                } else {
                    // Arch DOWN
                    const bottomY = Math.max(startY, worldMouseY) + archHeight;
                    c1y = bottomY; c2y = bottomY;
                }

                const sign = (worldMouseX > startX) ? 1 : -1;
                c1x = startX + (60 * sign);
                c2x = worldMouseX - (60 * sign);
            }
        }

        const d = `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${worldMouseX} ${worldMouseY}`;
        dragPath.setAttribute('d', d);
    }

    // Touch Event Support for Mobile
    function setupTouchEvents() {
        let touchStartTime = 0;
        let touchStartPos = { x: 0, y: 0 };
        let isTouchMove = false;

        // Helper to convert touch to mouse event
        function touchToMouse(touch) {
            return {
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => { },
                stopPropagation: () => { },
                target: touch.target,
                shiftKey: false
            };
        }

        // Canvas touch events
        canvasContainer.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            const touch = e.touches[0];
            touchStartPos = { x: touch.clientX, y: touch.clientY };
            isTouchMove = false;

            // Check if touching a node
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target && target.closest('.node')) {
                // Let node handle it
                return;
            }

            // Start panning
            const mouseEvent = touchToMouse(touch);
            mindMapState.isDragging = true;
            mindMapState.lastMousePos = { x: touch.clientX, y: touch.clientY };
            canvasContainer.style.cursor = 'grabbing';
        }, { passive: false });

        canvasContainer.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
            isTouchMove = true;
            const touch = e.touches[0];

            // Simulate mousemove
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            window.dispatchEvent(mouseEvent);
        }, { passive: false });

        canvasContainer.addEventListener('touchend', (e) => {
            const touchDuration = Date.now() - touchStartTime;
            const touch = e.changedTouches[0];
            const distance = Math.hypot(
                touch.clientX - touchStartPos.x,
                touch.clientY - touchStartPos.y
            );

            // Simulate mouseup
            const mouseEvent = new MouseEvent('mouseup', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            window.dispatchEvent(mouseEvent);

            // Handle tap (short touch without movement)
            if (touchDuration < 300 && distance < 10 && !isTouchMove) {
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                if (target) {
                    target.click();
                }
            }

            isTouchMove = false;
        }, { passive: false });

        if (!isTouchEventsAdded) {
            // Prevent default touch behaviors on interactive elements
            document.addEventListener('touchstart', (e) => {
                const target = e.target;
                if (target.closest('.node') ||
                    target.closest('.handle') ||
                    target.closest('.image-frame') ||
                    target.closest('.connection-handle-group') ||
                    target.closest('.resize-handle') ||
                    target.closest('.image-resizer')) {
                    // Allow touch on interactive elements
                    const touch = e.touches[0];

                    // Create and dispatch synthetic mousedown
                    const mouseEvent = new MouseEvent('mousedown', {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        bubbles: true,
                        cancelable: true
                    });
                    target.dispatchEvent(mouseEvent);
                }
            }, { passive: false });

            // Touch move for draggable elements
            document.addEventListener('touchmove', (e) => {
                if (mindMapState.isNodeDragging ||
                    mindMapState.imageDrag.active ||
                    mindMapState.imageResize.active ||
                    mindMapState.connectionDrag.active ||
                    mindMapState.archDrag.active ||
                    mindMapState.nodeResize.active) {
                    e.preventDefault();

                    const touch = e.touches[0];
                    const mouseEvent = new MouseEvent('mousemove', {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        bubbles: true
                    });
                    window.dispatchEvent(mouseEvent);
                }
            }, { passive: false });

            // Touch end for draggable elements
            document.addEventListener('touchend', (e) => {
                if (mindMapState.isNodeDragging ||
                    mindMapState.imageDrag.active ||
                    mindMapState.imageResize.active ||
                    mindMapState.connectionDrag.active ||
                    mindMapState.archDrag.active ||
                    mindMapState.nodeResize.active) {

                    const touch = e.changedTouches[0];
                    const mouseEvent = new MouseEvent('mouseup', {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        bubbles: true
                    });
                    window.dispatchEvent(mouseEvent);
                }
            }, { passive: false });

            isTouchEventsAdded = true;
        }

        // Pinch to zoom
        let lastTouchDistance = 0;
        canvasContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                lastTouchDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
            }
        }, { passive: true });

        canvasContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const distance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );

                if (lastTouchDistance > 0) {
                    const delta = distance / lastTouchDistance;
                    zoom(delta);
                }
                lastTouchDistance = distance;
            }
        }, { passive: false });

        canvasContainer.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                lastTouchDistance = 0;
            }
        }, { passive: true });
    }

    function exportData() {
        return {
            root: JSON.parse(JSON.stringify(mindMapState.root)),
            images: JSON.parse(JSON.stringify(mindMapState.images)),
            columnLabels: JSON.parse(JSON.stringify(mindMapState.columnLabels)),
            pan: { ...mindMapState.pan },
            scale: mindMapState.scale
        };
    }

    function loadData(data, defaultText) {
        console.log('MindMapModule: loadData called', { hasData: !!data, defaultText });
        const resolvedText = defaultText || '\u30bf\u30b9\u30af\u540d\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044';

        // Calculate canvas center for initial pan (so root node at y=0 appears in center)
        const canvasW = (canvasContainer && canvasContainer.offsetWidth > 0)
            ? canvasContainer.offsetWidth
            : (isEmbedded ? 800 : window.innerWidth);
        const canvasH = (canvasContainer && canvasContainer.offsetHeight > 0)
            ? canvasContainer.offsetHeight
            : (isEmbedded ? 480 : window.innerHeight);

        if (!data || !data.root) {
            const newRootId = generateUUID();
            mindMapState.root = { id: newRootId, text: resolvedText, x: 0, y: 0, column: 0, children: [] };
            mindMapState.images = [];
            mindMapState.columnLabels = {};
            // Place root at horizontal 1/4, vertical center
            mindMapState.pan = { x: canvasW / 4, y: canvasH / 2 };
            mindMapState.scale = 1;
        } else {
            mindMapState.root = data.root;
            // Always sync text with task name
            mindMapState.root.text = resolvedText;
            mindMapState.images = data.images || [];
            mindMapState.columnLabels = data.columnLabels || {};
            mindMapState.pan = data.pan || { x: canvasW / 4, y: canvasH / 2 };
            mindMapState.scale = data.scale || 1;
        }
        mindMapState.selectedNodeId = mindMapState.root.id;
        mindMapState.history = [];
        mindMapState.future = [];
        updateLayout();
        render();
        updateUndoRedoButtons();

        // Use ResizeObserver to center reliably once the canvas has real dimensions
        // (The modal CSS animation may delay layout until after the transition ends)
        if (canvasContainer && typeof ResizeObserver !== 'undefined') {
            let centered = false;
            const ro = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    if (width > 0 && height > 0 && !centered) {
                        centered = true;
                        ro.disconnect();
                        fitToScreen();
                        // Second pass after child nodes settle
                        setTimeout(() => fitToScreen(), 300);
                    }
                }
            });
            ro.observe(canvasContainer);
            // Safety fallback in case ResizeObserver never fires
            setTimeout(() => {
                if (!centered) {
                    centered = true;
                    ro.disconnect();
                    fitToScreen();
                }
            }, 1500);
        } else {
            // Fallback for environments without ResizeObserver
            setTimeout(() => fitToScreen(), 300);
            setTimeout(() => fitToScreen(), 800);
        }
    }

    function setRootText(text) {
        if (mindMapState.root) {
            mindMapState.root.text = text || '';
            render();
        }
    }

    function setAssigneeFilter(indices) {
        mindMapState.allowedMemberIndices = indices;
    }

    // Start
    return {
        init: init,
        loadData: loadData,
        setRootText: setRootText,
        setAssigneeFilter: setAssigneeFilter,
        exportData: exportData,
        addChildToRoot: () => {
            if (mindMapState.root) {
                addNode(mindMapState.root.id, 'ステップ');
            }
        },
        resetToGlobal: () => {
            isEmbedded = false;
            init();
        }
    };
})();

// Automatic initialization is removed to be controlled by app.js or just called once here if safe
// MindMapModule.init();
// setupTouchEvents();
// End of file
