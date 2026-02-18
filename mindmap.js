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
    // State Management
    const STORAGE_KEY = 'mindmap_data_v1';

    const rootId = generateUUID();
    let mindMapState = {
        root: {
            id: rootId,
            text: 'Central Idea',
            x: 0,
            y: 0,
            column: 0,
            children: []
        },
        images: [], // New images array
        columnLabels: {}, // Generation labels
        pan: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        scale: 1,
        isDragging: false,
        lastMousePos: { x: 0, y: 0 },

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
        const data = {
            version: 1,
            root: mindMapState.root,
            images: mindMapState.images,
            columnLabels: mindMapState.columnLabels,
            pan: mindMapState.pan,
            scale: mindMapState.scale
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function restoreState() {
        const saved = localStorage.getItem(STORAGE_KEY);
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
        const undoBtn = document.getElementById('mm-undo-btn');
        const redoBtn = document.getElementById('mm-redo-btn');

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
    let canvasContainer, nodesLayer, connectionsLayer, gridLayer, foregroundLayer, zoomLevelEl;

    // Initialization
    // Initialization
    let isInitialized = false;
    function init() {
        // Select elements first
        canvasContainer = document.getElementById('mm-canvas-container');
        nodesLayer = document.getElementById('mm-nodes-layer');
        connectionsLayer = document.getElementById('mm-connections-layer');
        gridLayer = document.getElementById('mm-grid-layer');
        foregroundLayer = document.getElementById('mm-foreground-layer');
        zoomLevelEl = document.getElementById('mm-zoom-level');

        if (!canvasContainer || !nodesLayer) {
            console.error('MindMapModule: Required elements not found. Initialization aborted.');
            return;
        }

        if (isInitialized) {
            updateLayout();
            render();
            return;
        }
        isInitialized = true;
        // Set CSS custom property for mobile viewport height
        function setViewportHeight() {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }

        // Set on load
        setViewportHeight();

        // Update on resize and orientation change
        window.addEventListener('resize', setViewportHeight);
        window.addEventListener('orientationchange', () => {
            setTimeout(setViewportHeight, 100);
        });

        // Mobile UI Adjustment
        // Mobile UI Adjustment
        function adjustMobileUI() {
            // Broaden mobile detection: Small screen OR touch device
            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            const isSmallScreen = window.innerWidth <= 1024; // Increased threshold
            const isMobile = isSmallScreen || isTouch;

            const btnTexts = document.querySelectorAll('.btn-text');

            // Add class to body for CSS overrides
            if (isMobile) {
                document.body.classList.add('is-mobile');
            } else {
                document.body.classList.remove('is-mobile');
            }

            btnTexts.forEach(span => {
                if (isMobile) {
                    // Determine text if not stored
                    if (!span.getAttribute('data-text')) {
                        span.setAttribute('data-text', span.innerText);
                    }
                    span.style.display = 'none';
                    span.innerText = ''; // Force clear
                } else {
                    // Restore text
                    const text = span.getAttribute('data-text');
                    if (text) {
                        span.innerText = text;
                        span.style.display = ''; // Reset display
                    }
                }
            });
        }

        // Run on load and resize
        adjustMobileUI();
        window.addEventListener('resize', adjustMobileUI);

        setupEventListeners();
        setupKeyboardShortcuts();
        restoreState();

        // UI Undo/Redo
        const undoBtn = document.getElementById('mm-undo-btn');
        if (undoBtn) undoBtn.onclick = undo;
        const redoBtn = document.getElementById('mm-redo-btn');
        if (redoBtn) redoBtn.onclick = redo;
        const clearBtn = document.getElementById('mm-clear-all-btn');
        if (clearBtn) clearBtn.onclick = clearAll;

        // Image Button
        const addImgBtn = document.getElementById('mm-add-image-btn');
        if (addImgBtn) {
            addImgBtn.onclick = () => {
                const rect = canvasContainer.getBoundingClientRect();
                // Use current scale/pan
                const centerX = (rect.width / 2 - mindMapState.pan.x) / mindMapState.scale;
                const centerY = (rect.height / 2 - mindMapState.pan.y) / mindMapState.scale;
                addImage(centerX - 100, centerY - 75);
            };
        }

        const imgInput = document.getElementById('mm-image-upload-input');
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

        updateUndoRedoButtons();
        initContextMenu();
        updateLayout();
        render();
        setupTouchEvents();
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
        const layer = document.getElementById('mm-images-layer');
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
                        document.removeEventListener('mousedown', closeMenu);
                    }
                };

                menu.appendChild(changeItem);
                menu.appendChild(pasteItem);
                menu.appendChild(deleteItem);
                document.body.appendChild(menu);

                setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
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

            COLOR_PALETTE.forEach(color => {
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.style.backgroundColor = color;
                swatch.dataset.color = color;
                swatch.title = color;

                swatch.onclick = (e) => {
                    e.stopPropagation();
                    if (mindMapState.contextMenu.nodeId) {
                        const node = findNode(mindMapState.contextMenu.nodeId);
                        if (node) {
                            saveState();
                            node.color = color;
                            render();
                        }
                    }
                    hideContextMenu();
                };
                menu.appendChild(swatch);
            });
        }

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#context-menu')) {
                hideContextMenu();
            }
        });
    }

    function showContextMenu(nodeId, x, y) {
        mindMapState.contextMenu.nodeId = nodeId;
        mindMapState.contextMenu.active = true;
        const menu = document.getElementById('context-menu');
        menu.classList.remove('hidden');

        // Position
        const rect = menu.getBoundingClientRect();
        let left = x + 10;
        let top = y + 10;

        // Bounds check
        if (left + rect.width > window.innerWidth) left = x - rect.width - 10;
        if (top + rect.height > window.innerHeight) top = y - rect.height - 10;

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function hideContextMenu() {
        mindMapState.contextMenu.active = false;
        mindMapState.contextMenu.nodeId = null;
        const menu = document.getElementById('context-menu');
        if (menu) menu.classList.add('hidden');
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
        const imagesLayer = document.getElementById('mm-images-layer');
        if (imagesLayer) imagesLayer.style.transform = cssTransform;

        // Update SVG transforms
        [connectionsLayer, foregroundLayer, gridLayer].forEach(layer => {
            const g = layer.querySelector('g');
            if (g) g.setAttribute('transform', svgTransform);
        });

        zoomLevelEl.textContent = `${Math.round(mindMapState.scale * 100)}%`;
    }

    function render() {
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
        el.textContent = node.text;

        if (node.color) {
            el.style.backgroundColor = node.color;
            // Improve visibility for custom colors
            el.style.borderColor = 'rgba(255,255,255,0.2)';
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
                        document.removeEventListener('mousedown', closeMenu);
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
                        document.removeEventListener('mousedown', closeMenu);
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
                        document.removeEventListener('mousedown', closeMenu);
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
                        document.removeEventListener('mousedown', closeMenu);
                    }
                };
                document.body.appendChild(menu);
                setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
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
        // Shortcuts
        document.addEventListener('keydown', (e) => {
            // Ignore if input is focused
            if (e.target.tagName === 'INPUT') return;

            switch (e.key) {
                case 'Tab':
                    e.preventDefault();
                    if (mindMapState.selectedNodeId) addNode(mindMapState.selectedNodeId);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (mindMapState.selectedNodeId) {
                        if (mindMapState.selectedNodeId === mindMapState.root.id) {
                            // Auto-fix: Sibling on Root -> Add Child
                            addNode(mindMapState.selectedNodeId);
                            showToast('Root cannot have siblings. Added child instead.');
                        } else {
                            addSibling(mindMapState.selectedNodeId);
                        }
                    }
                    break;
                case 'Delete':
                case 'Backspace':
                    if (mindMapState.selectedNodeId) {
                        if (mindMapState.selectedNodeId === mindMapState.root.id) {
                            showToast('Cannot delete the root node.', 'error');
                        } else {
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
        });

        // Global Mouse Handlers for Pan & Drag
        canvasContainer.addEventListener('mousedown', (e) => {
            // Clear connection selection if clicking empty space
            if (!e.target.closest('.connection-handle-group') && !e.target.closest('.node')) {
                if (mindMapState.selectedConnection) {
                    mindMapState.selectedConnection = null;
                    render();
                }
            }

            if (e.target.closest('.node')) return; // Don't pan if clicking node

            mindMapState.isDragging = true;
            mindMapState.lastMousePos = { x: e.clientX, y: e.clientY };
            canvasContainer.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            // Arch Height Dragging
            if (mindMapState.archDrag.active) {
                const source = findNode(mindMapState.archDrag.sourceId);
                const target = findNode(mindMapState.archDrag.targetId);
                if (!source || !target) return;

                if (!mindMapState.archDrag.dragged) {
                    if (Math.hypot(e.clientX - mindMapState.archDrag.startX, e.clientY - mindMapState.archDrag.startY) > 5) mindMapState.archDrag.dragged = true;
                }

                const rect = canvasContainer.getBoundingClientRect();
                // Current mouse in world space
                const worldMouseX = (e.clientX - rect.left - mindMapState.pan.x) / mindMapState.scale;
                const worldMouseY = (e.clientY - rect.top - mindMapState.pan.y) / mindMapState.scale;
                // Start mouse in world space
                const startWorldX = (mindMapState.archDrag.startX - rect.left - mindMapState.pan.x) / mindMapState.scale;
                const startWorldY = (mindMapState.archDrag.startY - rect.top - mindMapState.pan.y) / mindMapState.scale;

                const isSelfLoop = (source.id === target.id);
                const colStep = (target.column || 0) - (source.column || 0);

                // 1. Ports
                const pEl = nodesLayer.querySelector(`[data-id="${source.id}"]`);
                if (!pEl) return;
                const pWidth = pEl.offsetWidth;
                let pX = source.x + pWidth;
                let pY = source.y;
                let cX = target.x - 4;
                let cY = target.y;

                if (mindMapState.archDrag.isRelation) {
                    const idx = (source.relations || []).findIndex(r => (typeof r === 'string' ? r === target.id : r.id === target.id));
                    pY += 6 + (idx * 6);
                    cY += 6;
                }
                if (isSelfLoop) {
                    const nodeH = pEl.offsetHeight;
                    const spreadOffset = nodeH * 0.4;
                    pY = source.y - spreadOffset;
                    cY = source.y + spreadOffset;
                    pX = source.x + pWidth;
                    cX = source.x - 4;
                }

                // 2. Interaction: X is Width Delta, Y is Height position direct mapping
                // Horizontal: Stretching the bulge
                let newW = mindMapState.archDrag.startArchWidth + (worldMouseX - startWorldX);
                // Vertical: Handle moves only up/down, maps to mouse Y
                const signedH = (8 * worldMouseY - 4 * pY - 4 * cY) / 6;
                const newH = Math.abs(signedH);
                const isNowUp = (signedH < 0);

                // Update mindMapState
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

                // 3. Real-time DOM Update
                const path = mindMapState.archDrag.cachedPath;
                const hGroup = mindMapState.archDrag.cachedHandleGroup;
                if (path || hGroup) {
                    // SymmetricalWeights lock handle to X midpoint: Mx = (pX+cX)/2
                    const c1x = pX + newW;
                    const c2x = cX - newW;
                    const c1y = pY + signedH;
                    const c2y = cY + signedH;

                    const d = `M ${pX} ${pY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${cX} ${cY}`;
                    if (path) path.setAttribute('d', d);
                    const hx = (pX + 3 * c1x + 3 * c2x + cX) / 8; // result: (4pX+4cX)/8 = (pX+cX)/2
                    const hy = (pY + 3 * c1y + 3 * c2y + cY) / 8;
                    if (hGroup) hGroup.setAttribute('transform', `translate(${hx}, ${hy})`);
                }
                return;
            }

            // Connection Dragging
            if (mindMapState.connectionDrag.active) {
                mindMapState.connectionDrag.currentPos = { x: e.clientX, y: e.clientY };

                // Hit Test & Target Highlighting
                const nodes = document.elementsFromPoint(e.clientX, e.clientY);
                // Allow target to be source for self-loops (relations)
                const targetEl = nodes.find(el => el.classList.contains('node'));
                const newTargetId = targetEl ? targetEl.dataset.id : null;

                if (mindMapState.dropTargetId !== newTargetId) {
                    // Update classes manually to avoid re-render
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

                // Draw Drag Line
                updateDragLine();

                return;
            }

            // Node Dragging
            if (mindMapState.potentialDragNodeId && !mindMapState.isNodeDragging) {
                const dx = e.clientX - mindMapState.dragStartPos.x;
                const dy = e.clientY - mindMapState.dragStartPos.y;
                if (Math.hypot(dx, dy) > 5) { // Threshold
                    if (mindMapState.potentialDragNodeId !== mindMapState.root.id) {
                        mindMapState.isNodeDragging = true;
                        mindMapState.draggedNodeId = mindMapState.potentialDragNodeId;
                        canvasContainer.style.cursor = 'move';
                        render(); // Apply classes
                    } else {
                        mindMapState.potentialDragNodeId = null; // Can't drag root
                    }
                }
            }

            if (mindMapState.isNodeDragging) {
                // Hit Test for Target
                const nodes = document.elementsFromPoint(e.clientX, e.clientY);
                const targetEl = nodes.find(el => el.classList.contains('node') && el.dataset.id !== mindMapState.draggedNodeId);
                const newTargetId = targetEl ? targetEl.dataset.id : null;

                let newTargetType = 'parent';
                let newTargetIndex = -1;

                if (newTargetId) {
                    const draggedParent = findParent(mindMapState.draggedNodeId);
                    const targetParent = findParent(newTargetId);

                    // Check if target is a sibling for reordering
                    if (draggedParent && targetParent && draggedParent.id === targetParent.id) {
                        newTargetType = 'sibling';
                        const rect = targetEl.getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        const children = draggedParent.children;
                        const targetIdx = children.findIndex(c => c.id === newTargetId);

                        if (e.clientY < midY) {
                            newTargetIndex = targetIdx;
                        } else {
                            newTargetIndex = targetIdx + 1;
                        }
                    }
                }

                if (mindMapState.dropTargetId !== newTargetId || mindMapState.dropTargetIndex !== newTargetIndex) {
                    mindMapState.dropTargetId = newTargetId;
                    mindMapState.dropTargetType = newTargetType;
                    mindMapState.dropTargetIndex = newTargetIndex;
                    render(); // Update highlight
                }
                return; // Don't pan while dragging node
            }



            // Image Drag
            if (mindMapState.imageDrag.active) {
                const dx = e.clientX - mindMapState.imageDrag.lastX;
                const dy = e.clientY - mindMapState.imageDrag.lastY;

                const img = mindMapState.images.find(img => img.id === mindMapState.imageDrag.id);
                if (img) {
                    // We update position. 
                    // We need to account for scale if we want pixel perfect drag on scaled canvas?
                    // Yes: dx / scale
                    img.x += dx / mindMapState.scale;
                    img.y += dy / mindMapState.scale;
                    mindMapState.imageDrag.lastX = e.clientX;
                    mindMapState.imageDrag.lastY = e.clientY;
                    renderImages(); // Re-render images only
                }
                return;
            }

            // Image Resize
            if (mindMapState.imageResize.active) {
                const idx = mindMapState.images.findIndex(img => img.id === mindMapState.imageResize.id);
                if (idx !== -1) {
                    const dx = e.clientX - mindMapState.imageResize.startX;
                    const dy = e.clientY - mindMapState.imageResize.startY;

                    const newW = Math.max(50, mindMapState.imageResize.startW + (dx / mindMapState.scale));
                    const newH = Math.max(50, mindMapState.imageResize.startH + (dy / mindMapState.scale));

                    mindMapState.images[idx].width = newW;
                    mindMapState.images[idx].height = newH;
                    renderImages();
                }
                return;
            }

            // Canvas Panning
            if (mindMapState.isDragging) {
                const dx = e.clientX - mindMapState.lastMousePos.x;
                const dy = e.clientY - mindMapState.lastMousePos.y;
                mindMapState.pan.x += dx;
                mindMapState.pan.y += dy;
                mindMapState.lastMousePos = { x: e.clientX, y: e.clientY };
                updateView(); // Efficient view update only
            }

            // Node Resizing
            if (mindMapState.nodeResize.active) {
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
        });

        window.addEventListener('mouseup', (e) => {
            if (mindMapState.nodeResize.active) {
                mindMapState.nodeResize.active = false;
                canvasContainer.style.cursor = 'grab';
                return;
            }

            if (mindMapState.imageDrag.active) {
                mindMapState.imageDrag.active = false;
                mindMapState.imageDrag.id = null;
                persistState(); // Save after move
                return;
            }

            if (mindMapState.imageResize.active) {
                mindMapState.imageResize.active = false;
                mindMapState.imageResize.id = null;
                persistState(); // Save after resize
                return;
            }

            if (mindMapState.archDrag.active) {
                mindMapState.archDrag.active = false;
                // Clear dragged flag after a small delay to prevent immediate click
                setTimeout(() => { mindMapState.archDrag.dragged = false; }, 200);
                canvasContainer.style.cursor = 'grab';
                return;
            }

            // End Connection Drag
            if (mindMapState.connectionDrag.active) {
                const sourceId = mindMapState.connectionDrag.sourceNodeId;
                const targetId = mindMapState.dropTargetId;
                const type = mindMapState.connectionDrag.type;
                const mousePos = { x: e.clientX, y: e.clientY };

                // Cleanup Highlights
                canvasContainer.classList.remove('dragging-in', 'dragging-out');

                // Cleanup Drag Line
                const dragLine = document.getElementById('drag-line');
                if (dragLine) dragLine.remove();

                if (mindMapState.dropTargetId) {
                    const el = nodesLayer.querySelector(`[data-id="${mindMapState.dropTargetId}"]`);
                    if (el) el.classList.remove('drop-target');
                }

                mindMapState.connectionDrag.active = false;

                // ACTION
                if (targetId) {
                    if (type === 'out') {
                        // Calculate World Coordinates to determine Arch Choice
                        const sourceNode = findNode(sourceId);
                        const rect = canvasContainer.getBoundingClientRect();
                        const worldY = (e.clientY - rect.top - mindMapState.pan.y) / mindMapState.scale;

                        let archChoice = 'auto';
                        if (sourceNode) {
                            const dy = worldY - sourceNode.y;
                            if (dy < -30) archChoice = 'up';
                            else if (dy > 30) archChoice = 'down';
                        }

                        toggleRelation(sourceId, targetId, archChoice);
                    } else if (sourceId !== targetId) {
                        // 'in' drag: cannot make self as parent
                        moveNodeTo(sourceId, targetId);
                    }
                } else if (!targetId && type === 'out') {
                    addNode(sourceId);
                    showToast('New node created.');
                }

                mindMapState.connectionDrag.sourceNodeId = null;
                mindMapState.dropTargetId = null;
                canvasContainer.style.cursor = 'grab';
                render();
                return;
            }

            // End Node Drag
            if (mindMapState.isNodeDragging) {
                if (mindMapState.draggedNodeId && mindMapState.dropTargetId) {
                    if (mindMapState.dropTargetType === 'sibling') {
                        // Reorder within parent
                        saveState();
                        const parent = findParent(mindMapState.draggedNodeId);
                        const oldIdx = parent.children.findIndex(c => c.id === mindMapState.draggedNodeId);
                        const nodeRecord = parent.children.splice(oldIdx, 1)[0];

                        let newIdx = mindMapState.dropTargetIndex;
                        if (oldIdx < newIdx) newIdx--; // Adjust for shift after removal
                        parent.children.splice(newIdx, 0, nodeRecord);

                        updateLayout();
                    } else if (e.shiftKey) {
                        toggleRelation(mindMapState.draggedNodeId, mindMapState.dropTargetId);
                    } else {
                        moveNodeTo(mindMapState.draggedNodeId, mindMapState.dropTargetId);
                    }
                }
                mindMapState.isNodeDragging = false;
                mindMapState.draggedNodeId = null;
                mindMapState.dropTargetId = null;
                mindMapState.dropTargetType = null;
                mindMapState.dropTargetIndex = -1;
                mindMapState.potentialDragNodeId = null;
                canvasContainer.style.cursor = 'grab';
                render();
                return;
            }

            // If simply clicked node (no drag)
            if (mindMapState.potentialDragNodeId) {
                selectNode(mindMapState.potentialDragNodeId);
                mindMapState.potentialDragNodeId = null;
            }

            mindMapState.isDragging = false;
            canvasContainer.style.cursor = 'grab';
            persistState(); // Save pan position after dragging
        });

        // Zooming
        canvasContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            zoom(delta);
        }, { passive: false });

        // Buttons
        document.getElementById('mm-add-child-btn').onclick = () => {
            mindMapState.selectedNodeId ? addNode(mindMapState.selectedNodeId) : showToast('Select a node.', 'error');
        };
        document.getElementById('mm-add-sibling-btn').onclick = () => {
            if (mindMapState.selectedNodeId) {
                mindMapState.selectedNodeId === mindMapState.root.id ?
                    (addNode(mindMapState.selectedNodeId), showToast('Root cannot have siblings. Added child instead.')) :
                    addSibling(mindMapState.selectedNodeId);
            } else showToast('Select a node.', 'error');
        };
        document.getElementById('mm-delete-btn').onclick = () => {
            if (mindMapState.selectedNodeId) {
                mindMapState.selectedNodeId === mindMapState.root.id ? showToast('Cannot delete root.', 'error') : deleteNode(mindMapState.selectedNodeId);
            } else if (mindMapState.selectedImageId) {
                deleteImage(mindMapState.selectedImageId);
            } else showToast('Select a node or image.', 'error');
        };

        // New Buttons
        document.getElementById('mm-move-up-btn').onclick = () => {
            mindMapState.selectedNodeId ? moveNodeUp(mindMapState.selectedNodeId) : showToast('Select a node.', 'error');
        };
        document.getElementById('mm-move-down-btn').onclick = () => {
            mindMapState.selectedNodeId ? moveNodeDown(mindMapState.selectedNodeId) : showToast('Select a node.', 'error');
        };

        document.getElementById('mm-center-btn').onclick = centerView;
        document.getElementById('mm-zoom-in').onclick = () => zoom(1.2);
        document.getElementById('mm-zoom-out').onclick = () => zoom(0.8);

        // Save/Load
        document.getElementById('mm-export-btn').onclick = saveMap;
        document.getElementById('mm-import-btn-trigger').onclick = () => document.getElementById('mm-import-input').click();
        document.getElementById('mm-import-input').onchange = loadMap;
        document.getElementById('mm-export-pdf-btn').onclick = () => {
            try {
                // Clone & Print Strategy for perfect A4 output
                let printContainer = document.getElementById('print-container');
                if (!printContainer) {
                    printContainer = document.createElement('div');
                    printContainer.id = 'print-container';
                    document.body.appendChild(printContainer);
                }
                printContainer.innerHTML = ''; // Clear previous

                // 1. Calculate Bounds of Data
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                const traverse = (node) => {
                    const width = node.customWidth || node.measuredWidth || CONFIG.nodeWidth;
                    const height = node.customHeight || node.measuredHeight || CONFIG.nodeHeight;
                    minX = Math.min(minX, node.x);
                    maxX = Math.max(maxX, node.x + width);
                    minY = Math.min(minY, node.y - height / 2);
                    maxY = Math.max(maxY, node.y + height / 2);
                    if (node.children) node.children.forEach(traverse);
                };
                traverse(mindMapState.root);

                mindMapState.images.forEach(img => {
                    minX = Math.min(minX, img.x);
                    maxX = Math.max(maxX, img.x + img.width);
                    minY = Math.min(minY, img.y);
                    maxY = Math.max(maxY, img.y + img.height);
                });

                if (minX === Infinity) {
                    showToast('No content to export.', 'error');
                    return;
                }

                // A4 Landscape Dimensions
                const a4w = 1123;
                const a4h = 794;
                const outputMargin = 40; // Fixed margin in output pixels (approx 1cm)

                const contentW = maxX - minX;
                const contentH = maxY - minY;
                const availW = a4w - (outputMargin * 2);
                const availH = a4h - (outputMargin * 2);

                // 2. Calculate Scale to fit A4 (Available Area / Content Size)
                // Increased max scale further to 5.0
                const scale = Math.min(availW / contentW, availH / contentH, 5.0);

                // 3. Create Wrapper for transforming content to A4 center
                const wrapper = document.createElement('div');
                wrapper.style.position = 'absolute';
                wrapper.style.top = '0';
                wrapper.style.left = '0';
                wrapper.style.transformOrigin = '0 0';
                wrapper.style.width = '100%';
                wrapper.style.height = '100%';

                // Translate so that (minX, minY) moves to (0,0) then center in A4 available area
                const offsetX = (availW - contentW * scale) / 2;
                const offsetY = (availH - contentH * scale) / 2;

                // tx = Margin + CenteringOffset - (MinX * Scale)
                const tx = outputMargin + offsetX - (minX * scale);
                const ty = outputMargin + offsetY - (minY * scale);

                wrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;

                // 4. Clone Layers

                // Clone Connections (SVG) - Process FIRST to establish underlay
                const svgClone = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svgClone.style.position = 'absolute';
                svgClone.style.top = '0';
                svgClone.style.left = '0';
                svgClone.style.width = '100%';
                svgClone.style.height = '100%';
                svgClone.style.overflow = 'visible';
                svgClone.style.zIndex = '1';

                // Handle IDs to prevent 'display:none' issues with Markers
                const defs = document.querySelector('defs').cloneNode(true);
                const markers = defs.querySelectorAll('marker');
                markers.forEach(m => {
                    m.id = 'print-' + m.id;
                });
                svgClone.appendChild(defs);

                const connectionLayerEl = document.getElementById('mm-connections-layer');
                if (connectionLayerEl) {
                    const originalG = connectionLayerEl.querySelector('g');
                    if (originalG) {
                        const gClone = originalG.cloneNode(true);
                        gClone.setAttribute('transform', ''); // Remove view transform

                        // Update marker references in the cloned SVG HTML
                        let innerHTML = gClone.innerHTML;
                        innerHTML = innerHTML.replace(/url\(#([^)]+)\)/g, 'url(#print-$1)');
                        gClone.innerHTML = innerHTML;

                        svgClone.appendChild(gClone);
                    }
                }

                // Clone Images
                const imagesClone = document.getElementById('mm-images-layer').cloneNode(true);
                imagesClone.style.transform = 'none';
                imagesClone.id = ''; // Remove ID to avoid conflict, set position manually
                imagesClone.style.position = 'absolute';
                imagesClone.style.top = '0';
                imagesClone.style.left = '0';
                imagesClone.style.width = '100%';
                imagesClone.style.height = '100%';
                imagesClone.style.zIndex = '5';

                imagesClone.querySelectorAll('.image-resizer, .image-frame').forEach(el => {
                    if (el.classList.contains('image-resizer')) el.remove();
                    el.style.border = 'none'; // Clean look
                });

                // Clone Nodes
                const nodesClone = document.getElementById('mm-nodes-layer').cloneNode(true);
                nodesClone.style.transform = 'none';
                nodesClone.id = '';
                nodesClone.style.position = 'absolute';
                nodesClone.style.top = '0';
                nodesClone.style.left = '0';
                nodesClone.style.width = '100%';
                nodesClone.style.height = '100%';
                nodesClone.style.zIndex = '10'; // Ensure on top

                // Remove controls/handlers from clone
                nodesClone.querySelectorAll('.resize-handle, .handle').forEach(el => el.remove());

                // Freeze dimensions of nodes to prevent print-layout shift
                nodesClone.querySelectorAll('.node').forEach(cloneEl => {
                    const id = cloneEl.dataset.id;
                    const originalEl = document.querySelector(`#nodes-layer .node[data-id="${id}"]`);
                    if (originalEl) {
                        const w = originalEl.offsetWidth;
                        const h = originalEl.offsetHeight;
                        cloneEl.style.width = `${w}px`;
                        cloneEl.style.height = `${h}px`;
                        // prevent wrapping changes
                        cloneEl.style.boxSizing = 'border-box';
                        cloneEl.style.display = 'flex';
                        cloneEl.style.alignItems = 'center';
                        cloneEl.style.justifyContent = 'center';
                        cloneEl.style.whiteSpace = 'pre-wrap';
                        cloneEl.style.overflow = 'hidden';
                    }
                });

                // 5. Assemble
                wrapper.appendChild(svgClone);
                wrapper.appendChild(imagesClone);
                wrapper.appendChild(nodesClone);
                printContainer.appendChild(wrapper);

                // 6. Print Sequence
                document.body.classList.add('printing');

                // Cleanup function
                const cleanup = () => {
                    document.body.classList.remove('printing');
                    printContainer.innerHTML = '';
                    window.removeEventListener('afterprint', cleanup);
                };

                // Listen for print completion
                window.addEventListener('afterprint', cleanup);

                // Delay for rendering
                setTimeout(() => {
                    window.print();

                    // Fallback cleanup in case afterprint doesn't fire (e.g. mobile or specific browser scenarios)
                    // We use a long timeout to avoid clearing while dialog is open
                    setTimeout(() => {
                        // Check if still printing
                        if (document.body.classList.contains('printing')) {
                            // We don't force cleanup here automatically to avoid breaking long interactions,
                            // but we could offer a UI way to exit or just rely on afterprint.
                            // For now, assume afterprint works on target desktop browser.
                        }
                    }, 5000);
                }, 500);

            } catch (e) {
                console.error('PDF Export Error:', e);
                document.body.classList.remove('printing');
                showToast('PDF Export Failed: ' + e.message, 'error');
            }
        };
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
        mindMapState.pan.x = window.innerWidth / 4; // Start a bit left so tree expands right
        mindMapState.pan.y = window.innerHeight / 2;
        mindMapState.scale = 1;
        updateView(); // Efficient view update only
    }

    // Print & View Management
    function fitToScreen(forPrint = false) {
        // Calculate bounding box of all nodes AND images
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        // Check nodes
        const traverse = (node) => {
            const width = node.customWidth || node.measuredWidth || CONFIG.nodeWidth;
            const height = node.customHeight || node.measuredHeight || CONFIG.nodeHeight;

            // Node position (centered vertically, x is left)
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x + width);
            minY = Math.min(minY, node.y - height / 2);
            maxY = Math.max(maxY, node.y + height / 2);

            if (node.children) node.children.forEach(traverse);
        };
        traverse(mindMapState.root);

        // Check images
        mindMapState.images.forEach(img => {
            minX = Math.min(minX, img.x);
            maxX = Math.max(maxX, img.x + img.width);
            minY = Math.min(minY, img.y);
            maxY = Math.max(maxY, img.y + img.height);
        });

        if (minX === Infinity) return; // Empty

        // Add padding
        const padding = 50;
        const contentWidth = maxX - minX + (padding * 2);
        const contentHeight = maxY - minY + (padding * 2);

        let targetWidth, targetHeight;

        if (forPrint) {
            // Assume A4 Landscape: 297mm x 210mm (approx 1123px x 794px at 96dpi)
            // Or simply use a generic landscape aspect ratio 1.414
            // Use a large enough pixel value for high quality
            targetWidth = 1123;
            targetHeight = 794;
        } else {
            targetWidth = window.innerWidth;
            targetHeight = window.innerHeight;
        }

        // Calculate scale to fit
        const scaleX = targetWidth / contentWidth;
        const scaleY = targetHeight / contentHeight;
        let scale = Math.min(scaleX, scaleY);

        // Clamp scale (loosen limit for print)
        if (forPrint) {
            scale = Math.min(Math.max(scale, 0.1), 5);
        } else {
            scale = Math.min(Math.max(scale, 0.1), 2);
        }

        // Calculate center of content
        const centerX = minX - padding + (contentWidth / 2);
        const centerY = minY - padding + (contentHeight / 2);

        mindMapState.scale = scale;

        if (forPrint) {
            // For print, center in the target area
            // Note: CSS @page size landscape handles the rotation, 
            // we just need to position content to fit smoothly.
            // We set pan so that (centerX, centerY) is at (targetWidth/2, targetHeight/2)
            mindMapState.pan.x = (targetWidth / 2) - (centerX * scale);
            mindMapState.pan.y = (targetHeight / 2) - (centerY * scale);
        } else {
            mindMapState.pan.x = (targetWidth / 2) - (centerX * scale);
            mindMapState.pan.y = (targetHeight / 2) - (centerY * scale);
        }

        updateView();
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

    // Start
    return {
        init: init
    };
})();

// Automatic initialization is removed to be controlled by app.js or just called once here if safe
// MindMapModule.init();
// setupTouchEvents();
// End of file
