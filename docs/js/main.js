
document.addEventListener('DOMContentLoaded', () => {
    // Check if dependencies loaded
    if (typeof pixelit === 'undefined') {
        console.error("PixelIt library not loaded");
        alert("错误: 核心库未加载，请检查 js/pixelit.js 是否存在");
        return;
    }

    // Elements - Studio
    const fileInput = document.getElementById('fileInput');
    const sourceImage = document.getElementById('sourceImage');
    const scaleInput = document.getElementById('scaleInput');
    const scaleNumInput = document.getElementById('scaleNumInput'); // New
    const scaleVal = document.getElementById('scaleVal');
    const generateBtn = document.getElementById('generateBtn');
    const canvas = document.getElementById('pixelitcanvas');
    const paletteSelect = document.getElementById('paletteSelect');
    // const paletteFile = document.getElementById('paletteFile'); // Removed
    const statsTableBody = document.querySelector('#statsTable tbody');
    const completeBtn = document.getElementById('completeBtn');
    
    // Elements - Inventory
    const inventoryTableBody = document.querySelector('#inventoryTable tbody');
    const addBeadBtn = document.getElementById('addBeadBtn');
    const saveNewBeadBtn = document.getElementById('saveNewBeadBtn');
    const addBeadForm = document.getElementById('addBeadForm');
    const addBeadFn = new bootstrap.Modal(document.getElementById('addBeadModal'));

    // Elements - History
    const historyList = document.getElementById('historyList');

    // Export Buttons
    const btnPng = document.getElementById('downloadPng');
    const btnCsv = document.getElementById('downloadCsv');
    const btnStats = document.getElementById('downloadStats');
    const chkNumbers = document.getElementById('showNumbers');

    // Elements - Steps & Drawers
    const stepCards    = [null, 'step1Card','step2Card','step3Card','step4Card'].map(id => id ? document.getElementById(id) : null);
    const stepItemEls  = [null, 'stepItem1','stepItem2','stepItem3','stepItem4'].map(id => id ? document.getElementById(id) : null);
    const stepLineEls  = [null, 'stepLine1','stepLine2','stepLine3'].map(id => id ? document.getElementById(id) : null);
    const uploadZone   = document.getElementById('uploadZone');
    const uploadIcon   = document.getElementById('uploadIcon');
    const previewArea  = document.getElementById('previewArea');
    const previewInfo  = document.getElementById('previewInfo');
    const drawerOverlay    = document.getElementById('drawerOverlay');
    const inventoryDrawer  = document.getElementById('inventoryDrawer');
    const historyDrawer    = document.getElementById('historyDrawer');

    // Elements - Auth
    const loginModalEl = document.getElementById('loginModal');
    const loginModal = new bootstrap.Modal(loginModalEl);
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const userDisplay = document.getElementById('userDisplay');

    // Auth Logic
    const handleLoginSuccess = (user) => {
        loginModal.hide();
        currentUserId = user.id;
        userDisplay.innerText = `👤 ${user.username}`;
        logoutBtn.style.display = 'block';
        init(); // Start App
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            const user = await StorageService.login(
                formData.get('username'),
                formData.get('password')
            );
            handleLoginSuccess(user);
        } catch (err) {
            const alert = document.getElementById('loginError');
            alert.innerText = err.message;
            alert.classList.remove('d-none');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const confirmPwd = document.getElementById('confirmPassword').value;
        const confirmHint = document.getElementById('confirmPwdHint');
        const errorEl = document.getElementById('registerError');
        errorEl.classList.add('d-none');

        if (formData.get('password') !== confirmPwd) {
            confirmHint.classList.remove('d-none');
            return;
        }
        confirmHint.classList.add('d-none');

        try {
            const user = await StorageService.register(
                formData.get('username'),
                formData.get('password')
            );
            track('user_register');
            handleLoginSuccess(user);
        } catch (err) {
            errorEl.innerText = err.message;
            errorEl.classList.remove('d-none');
        }
    });

    logoutBtn.addEventListener('click', () => {
        StorageService.logout();
    });

    // --- Step Management ---
    let currentStep = 1;
    const stepNumLabels = ['1','2','3','4'];

    function activateStep(n) {
        for (let i = 1; i <= 4; i++) {
            const card = stepCards[i];
            const item = stepItemEls[i];
            if (!card || !item) continue;
            const dot = item.querySelector('.step-dot');

            card.classList.remove('active', 'locked', 'done', 'slide-in');
            item.classList.remove('active', 'done', 'locked');

            if (i < n) {
                item.classList.add('done');
                card.classList.add('done');
                if (dot) {
                    dot.textContent = '✓';
                    if (n > currentStep) { dot.classList.remove('dot-pop'); void dot.offsetWidth; dot.classList.add('dot-pop'); }
                }
                if (stepLineEls[i]) stepLineEls[i].classList.add('done');
            } else if (i === n) {
                item.classList.add('active');
                card.classList.add('active');
                if (dot) dot.textContent = stepNumLabels[i - 1];
                if (n > currentStep) {
                    requestAnimationFrame(() => card.classList.add('slide-in'));
                    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
                    // dot 弹跳
                    if (dot) { dot.classList.remove('dot-pop'); void dot.offsetWidth; dot.classList.add('dot-pop'); }
                }
            } else {
                card.classList.add('locked');
                item.classList.add('locked');
                if (dot) dot.textContent = stepNumLabels[i - 1];
                if (stepLineEls[i]) stepLineEls[i].classList.remove('done');
            }
        }
        currentStep = n;
    }

    // --- Drawer Management ---
    function openDrawer(drawer) {
        drawer.classList.add('open');
        drawerOverlay.classList.add('show');
    }
    function closeAllDrawers() {
        if (inventoryDrawer) inventoryDrawer.classList.remove('open');
        if (historyDrawer)   historyDrawer.classList.remove('open');
        if (drawerOverlay)   drawerOverlay.classList.remove('show');
    }

    const openInvBtn  = document.getElementById('openInventoryDrawer');
    const openHisBtn  = document.getElementById('openHistoryDrawer');
    const closeInvBtn = document.getElementById('closeInventoryDrawer');
    const closeHisBtn = document.getElementById('closeHistoryDrawer');
    const reuploadBtn = document.getElementById('reuploadBtn');

    if (openInvBtn)  openInvBtn.addEventListener('click', () => openDrawer(inventoryDrawer));
    if (openHisBtn)  openHisBtn.addEventListener('click', () => openDrawer(historyDrawer));
    if (closeInvBtn) closeInvBtn.addEventListener('click', closeAllDrawers);
    if (closeHisBtn) closeHisBtn.addEventListener('click', closeAllDrawers);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeAllDrawers);
    if (reuploadBtn) {
        reuploadBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });
    }

    // State
    let px = new pixelit({
        to: canvas,
        from: sourceImage,
        scale: 8,
        maxWidth: 2000,
        maxHeight: 2000
    });
    px.drawLabels = true;
    px.labelInterval = 5;

    let currentGridResponse = null;
    let originalGridResponse = null; // Store original for reset
    let currentCounts = null; // Store count result
    let currentUserId = null;

    // --- Analytics ---
    function track(eventName, properties = {}) {
        if (typeof gtag === 'function') {
            gtag('event', eventName, properties);
        }
        fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: eventName, userId: currentUserId, properties })
        }).catch(() => {});
    }


    // Default Palettes
    // Web Safe 216 colors + some extras to reach ~256
    const generateSafeColors = () => {
        const colors = [];
        const steps = [0, 51, 102, 153, 204, 255];
        for(let r of steps) {
            for(let g of steps) {
                for(let b of steps) {
                    colors.push([r,g,b]);
                }
            }
        }
        // Add some grays
        for(let i=0; i<256; i+=16) colors.push([i,i,i]);
        return colors;
    };

    const Palettes = {
        high_fidelity: generateSafeColors(),
        grayscale: [
            [0,0,0], [32,32,32], [64,64,64], [96,96,96], [128,128,128], 
            [160,160,160], [192,192,192], [224,224,224], [255,255,255]
        ]
    };

    // --- Logic ---

    // 1. Initialize
    const init = () => {
        renderInventoryTable();
        renderHistoryList();
        updatePalette();
    };

    // Helper: Update Palette
    const updatePalette = () => {
        const val = paletteSelect.value;
        if (val === 'my_inventory') {
            const inventoryPalette = StorageService.getPaletteForPixelIt();
            if (inventoryPalette.length > 0) {
                px.setPalette(inventoryPalette);
            } else {
                alert('库存为空！请在“我的豆子仓库”中添加颜色，或者选择其他色板。');
                paletteSelect.value = 'grayscale';
                updatePalette();
            }
        } else if (Palettes[val]) {
            px.setPalette(Palettes[val]);
        }
    };

    // --- Inventory Management ---
    
    function renderInventoryTable() {
        // Get inventory and sort by count (ascending)
        const inventory = StorageService.getInventory().sort((a, b) => a.count - b.count);
        inventoryTableBody.innerHTML = '';
        
        inventory.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="align-middle"><span class="color-box" style="background-color: ${item.hex};"></span></td>
                <td class="align-middle">${item.name}</td>
                <td class="align-middle">${item.hex}</td>
                <td class="align-middle">${item.id}</td>
                <td class="align-middle" title="双击修改" style="cursor: pointer;">
                    <span class="stock-val text-primary fw-bold" data-id="${item.id}">${item.count}</span>
                    <input type="number" class="form-control form-control-sm d-none stock-input" value="${item.count}" style="width: 100px;">
                </td>
                <td class="align-middle">
                    <button class="btn btn-sm btn-outline-danger delete-bead" data-id="${item.id}">删除</button>
                    <button class="btn btn-sm btn-success d-none save-stock" data-id="${item.id}">保存</button>
                </td>
            `;
            inventoryTableBody.appendChild(tr);

            // Bind Edit Event
            const valSpan = tr.querySelector('.stock-val');
            const input = tr.querySelector('.stock-input');
            const saveBtn = tr.querySelector('.save-stock');
            const deleteBtn = tr.querySelector('.delete-bead');

            // Toggle Edit
            tr.cells[4].addEventListener('dblclick', () => {
                valSpan.classList.add('d-none');
                input.classList.remove('d-none');
                input.focus();
                saveBtn.classList.remove('d-none');
                deleteBtn.classList.add('d-none');
            });

            // Save Logic
            const saveStock = async () => {
                const newCount = parseInt(input.value);
                if (!isNaN(newCount) && newCount >= 0) {
                    item.count = newCount;
                    // Find original item in unsorted array and update it
                    // Or just save the whole modified inventory list (which works if we don't rely on index)
                    // But wait, 'inventory' here is the sorted copy.
                    // StorageService.getInventory() returns a reference to the array usually?
                    // Let's call StorageService to update specific item logic
                    
                    // Actually, let's just update the full list via StorageService
                    // We need to fetch the LATEST full list from storage first to be safe
                    const currentInv = StorageService.getInventory();
                    const target = currentInv.find(i => i.id === item.id);
                    if(target) {
                        target.count = newCount;
                        await StorageService.saveInventory(currentInv);
                        
                        // Re-render to update sorting
                        renderInventoryTable();
                    }
                } else {
                    // Revert UI if invalid
                    valSpan.classList.remove('d-none');
                    input.classList.add('d-none');
                    saveBtn.classList.add('d-none');
                    deleteBtn.classList.remove('d-none');
                }
                
                // If Palette is My Inventory, refresh pixelit palette
                if (paletteSelect.value === 'my_inventory') updatePalette();
            };

            saveBtn.addEventListener('click', saveStock);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveStock();
            });

            deleteBtn.addEventListener('click', () => {
                if(confirm(`确定删除 ${item.name} 吗？`)) {
                    const currentInv = StorageService.getInventory();
                    const newInv = currentInv.filter(x => x.id !== item.id);
                    StorageService.saveInventory(newInv);
                    renderInventoryTable();
                    if (paletteSelect.value === 'my_inventory') updatePalette();
                }
            });
        });
    }

    addBeadBtn.addEventListener('click', () => {
        addBeadForm.reset();
        addBeadFn.show();
    });

    saveNewBeadBtn.addEventListener('click', () => {
        const formData = new FormData(addBeadForm);
        const newItem = {
            id: parseInt(formData.get('id')),
            name: formData.get('name'),
            hex: formData.get('hex'),
            count: parseInt(formData.get('count'))
        };
        
        if (!newItem.name || !newItem.hex || isNaN(newItem.id)) {
            alert('请完整填写信息');
            return;
        }

        const inv = StorageService.getInventory();
        inv.push(newItem);
        StorageService.saveInventory(inv);
        
        addBeadFn.hide();
        renderInventoryTable();
        if (paletteSelect.value === 'my_inventory') updatePalette();
    });

    // --- Studio Interactions ---

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            sourceImage.src = event.target.result;
            sourceImage.onload = () => {
                sourceImage.style.display = 'block';
                // Show preview & activate step 2
                if (previewArea)  previewArea.style.display = 'block';
                if (previewInfo)  previewInfo.textContent   = file.name;
                if (uploadIcon)   uploadIcon.textContent    = '✅';
                track('image_uploaded');
                activateStep(2);
            };
        };
        reader.readAsDataURL(file);
    });

    // Upload zone: click-to-open + drag-and-drop
    if (uploadZone) {
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
    }

    scaleInput.addEventListener('input', (e) => {
        const val = e.target.value;
        scaleVal.innerText = val;
        scaleNumInput.value = val;
    });

    scaleNumInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if(!val) return;
        if(val > 1000) val = 1000; 
        
        scaleVal.innerText = val;
        // Update range if within range, otherwise range stays at max
        scaleInput.value = val > 100 ? 100 : val; 
    });

    paletteSelect.addEventListener('change', updatePalette);

    generateBtn.addEventListener('click', () => {
        if (!sourceImage.src || !sourceImage.naturalWidth) {
            alert('请先上传图片');
            return;
        }

        // 显示 loading 状态
        const originalHTML = generateBtn.innerHTML;
        generateBtn.classList.add('btn-generating');
        generateBtn.innerHTML = '<span class="btn-spinner"></span>生成中...';

        setTimeout(() => {
            // 1. Get Target Size (Max Dimension)
            const targetSize = parseInt(scaleNumInput.value) || 50;

            // 2. Configure PixelIt to resize source to target resolution
            px.setScale(1)
              .setMaxWidth(targetSize)
              .setMaxHeight(targetSize);

            // 3. Generate Grid
            px.pixelate({ returnGrid: true });
            currentGridResponse = px.getGrid();
            originalGridResponse = JSON.parse(JSON.stringify(currentGridResponse));

            // 4. Re-draw for Display (Upscale)
            let visualScale = Math.floor(800 / targetSize);
            if (visualScale < 1) visualScale = 1;
            if (visualScale > 20) visualScale = 20;

            px.setScale(visualScale);
            px.drawGrid(currentGridResponse);

            activateStep(3);
            updateStats(currentGridResponse);
            track('grid_generated', { size: targetSize, palette: paletteSelect.value });

            // 恢复按钮
            generateBtn.classList.remove('btn-generating');
            generateBtn.innerHTML = originalHTML;
        }, 60);
    });


    // --- State for Modes ---
    // let isBeadingMode = false; // Removed
    let isManualEditMode = false;
    let currentBrush = { r: 0, g: 0, b: 0 }; // Default black

    // Edit Mode Toggle
    const toggleEditModeBtn = document.getElementById('toggleEditModeBtn');
    const editToolsDiv = document.getElementById('editTools');
    const resetEditsBtn = document.getElementById('resetEditsBtn');

    if (toggleEditModeBtn && editToolsDiv) {
        toggleEditModeBtn.addEventListener('click', () => {
            isManualEditMode = !isManualEditMode;
            if (isManualEditMode) {
                toggleEditModeBtn.innerText = "🔒 结束编辑 (锁定画布)";
                toggleEditModeBtn.classList.replace('btn-outline-danger', 'btn-danger');
                editToolsDiv.style.opacity = '1';
                editToolsDiv.style.pointerEvents = 'auto';
            } else {
                toggleEditModeBtn.innerText = "🔓 点击开启编辑模式";
                toggleEditModeBtn.classList.replace('btn-danger', 'btn-outline-danger');
                editToolsDiv.style.opacity = '0.5';
                editToolsDiv.style.pointerEvents = 'none';
            }
        });

        if (resetEditsBtn) {
            resetEditsBtn.addEventListener('click', () => {
                if (!originalGridResponse) return;
                if (confirm("确定要清除所有手工编辑吗？将重置为最初生成的图纸。")) {
                    currentGridResponse = JSON.parse(JSON.stringify(originalGridResponse));
                    px.drawGrid(currentGridResponse);
                    updateStats(currentGridResponse);
                }
            });
        }
    }

    // --- Magnifier Logic ---
    const magCanvas = document.getElementById('magnifierCanvas');
    const lensOverlay = document.getElementById('lensOverlay');
    const btnNextBlock = document.getElementById('btnNextBlock');
    const lensSizeInput = document.getElementById('lensSizeInput');
    const lensSizeVal = document.getElementById('lensSizeVal'); // New
    const openMagnifierBtn = document.getElementById('openMagnifierBtn');
    const closeMagnifierBtn = document.getElementById('closeMagnifierBtn');
    const magnifierFloatingWindow = document.getElementById('magnifierFloatingWindow');

    // State
    const magState = {
        enabled: false,
        x: 0, 
        y: 0,
        size: 10, 
        zoom: 2, // Unused logic variable, but effectively scale
        isDragging: false
    };

    const pxMag = new pixelit({ to: magCanvas, scale: 20 }); 
    pxMag.drawLabels = true;
    pxMag.labelInterval = 1;

    const magnifierOverlay = document.getElementById('magnifierOverlay');

    // Init Logic
    if(openMagnifierBtn) {
        openMagnifierBtn.addEventListener('click', () => {
            magState.enabled = true;
            if(magnifierFloatingWindow) magnifierFloatingWindow.style.display = 'block';
            if(lensOverlay) lensOverlay.style.display = 'block';
            if(magnifierOverlay) magnifierOverlay.classList.add('show');
            updateMagnifier();
        });
    }

    if(closeMagnifierBtn) {
        closeMagnifierBtn.addEventListener('click', () => {
             magState.enabled = false;
             if(magnifierFloatingWindow) magnifierFloatingWindow.style.display = 'none';
             if(lensOverlay) lensOverlay.style.display = 'none';
             if(magnifierOverlay) magnifierOverlay.classList.remove('show');
        });
    }

    if(magnifierOverlay) {
        magnifierOverlay.addEventListener('click', () => {
            magState.enabled = false;
            if(magnifierFloatingWindow) magnifierFloatingWindow.style.display = 'none';
            if(lensOverlay) lensOverlay.style.display = 'none';
            magnifierOverlay.classList.remove('show');
        });
    }

    if(lensSizeInput) {
        const updateLensInput = (e) => {
            let v = parseInt(e.target.value);
            // Min/Max are controlled by HTML range
            magState.size = v;
            if(lensSizeVal) lensSizeVal.innerText = v + '格';
            updateMagnifier();
        };

        lensSizeInput.addEventListener('input', updateLensInput);
        lensSizeInput.addEventListener('change', updateLensInput);
    }
/*
    if(magZoomInput) {
        magZoomInput.addEventListener('input', (e) => {
            magState.zoom = parseInt(e.target.value);
            if(magZoomVal) magZoomVal.innerText = magState.zoom + 'x';
            updateMagnifier();
        });
    }
*/
    // Floating Window Drag Logic
    const magnifierWindow = document.getElementById('magnifierFloatingWindow');
    const magnifierDragHeader = document.getElementById('magnifierDragHeader');

    if (magnifierDragHeader && magnifierWindow) {
        let isWindowDragging = false;
        let pX = 0, pY = 0;

        magnifierDragHeader.addEventListener('mousedown', (e) => {
            isWindowDragging = true;
            pX = e.clientX;
            pY = e.clientY;
            magnifierDragHeader.style.cursor = 'grabbing';
        });

        document.addEventListener('mouseup', () => {
            isWindowDragging = false;
            if(magnifierDragHeader) magnifierDragHeader.style.cursor = 'move';
        });

        document.addEventListener('mousemove', (e) => {
            if (isWindowDragging) {
                e.preventDefault();
                const dX = e.clientX - pX;
                const dY = e.clientY - pY;
                pX = e.clientX;
                pY = e.clientY;
                magnifierWindow.style.top = (magnifierWindow.offsetTop + dY) + "px";
                magnifierWindow.style.left = (magnifierWindow.offsetLeft + dX) + "px";
            }
        });
    }

    if(btnNextBlock) {
        btnNextBlock.addEventListener('click', () => {
            if(!currentGridResponse) return;
            
            const gridW = currentGridResponse[0].length;
            const gridH = currentGridResponse.length;
            
            magState.x += magState.size;
            
            if (magState.x >= gridW) {
                magState.x = 0;
                magState.y += magState.size;
            }
            
            if (magState.y >= gridH) {
                magState.y = 0;
                magState.x = 0;
                alert("已到达图纸末尾，回到起点");
            }
            updateMagnifier();
        });
    }

    function updateMagnifier() {
        if (!magState.enabled || !currentGridResponse || !lensOverlay) {
            if(lensOverlay) lensOverlay.style.display = 'none';
            return;
        }

        const gridW = currentGridResponse[0].length;
        const gridH = currentGridResponse.length;

        if (magState.x < 0) magState.x = 0;
        if (magState.y < 0) magState.y = 0;
        if (magState.x >= gridW) magState.x = gridW - 1;
        if (magState.y >= gridH) magState.y = gridH - 1;

        const subGrid = [];
        const endX = Math.min(magState.x + magState.size, gridW);
        const endY = Math.min(magState.y + magState.size, gridH);
        
        for(let r=magState.y; r<endY; r++) {
            subGrid.push(currentGridResponse[r].slice(magState.x, endX));
        }

        // Auto-fit scale logic
        // Container is approx 480px wide (card width) - padding.
        // We removed the height restriction, so we just fit to Width.
        const safeWidth = Math.min(420, window.innerWidth - 48);
        
        const cols = subGrid[0].length;
        const rows = subGrid.length;
        
        // Calculate scale to fit width
        let newScale = Math.floor(safeWidth / cols);
        
        // Cap the max scale so 1x1 block doesn't explode the screen
        if (newScale > 50) newScale = 50;
        
        // Minimum scale to be readable
        const finalScale = Math.max(newScale, 15); 

        pxMag.setScale(finalScale);
        pxMag.startOffsetX = magState.x;
        pxMag.startOffsetY = magState.y;
        pxMag.drawGrid(subGrid);

        const rect = canvas.getBoundingClientRect();
        if(gridW === 0 || gridH === 0) return;

        // Correct layout calculation incorporating margins from px.drawLabels
        // We need to know:
        // 1. px.margin (25 if labels are on)
        // 2. px.scale (8)
        // 3. The actual rendered width/height of the canvas (rect.width/height)
        
        const pxMargin = px.drawLabels ? 25 : 0; // Hardcoded margin from pixelit.js (this.margin=25)
        const logicalW = (gridW * px.scale) + pxMargin;
        const logicalH = (gridH * px.scale) + pxMargin;
        
        // Ratios: CSS pixels per Logical unit
        const ratioX = rect.width / logicalW;
        const ratioY = rect.height / logicalH;
        
        // Offset of the Grid Origin in CSS pixels
        const originX = pxMargin * ratioX;
        const originY = pxMargin * ratioY;
        
        // Size of one block in CSS pixels
        const visualBlockW = px.scale * ratioX;
        const visualBlockH = px.scale * ratioY;

        lensOverlay.style.display = 'block';
        lensOverlay.style.left = (canvas.offsetLeft + originX + magState.x * visualBlockW) + 'px';
        lensOverlay.style.top = (canvas.offsetTop + originY + magState.y * visualBlockH) + 'px';
        
        // Width/Height of overlay
        // We clip it if it exceeds bounds, but usually visualBlockW handles scaling.
        const dW = Math.min(magState.size, gridW - magState.x);
        const dH = Math.min(magState.size, gridH - magState.y);
        
        lensOverlay.style.width = (dW * visualBlockW) + 'px';
        lensOverlay.style.height = (dH * visualBlockH) + 'px';
        
        lensOverlay.style.pointerEvents = 'auto'; 
        lensOverlay.style.cursor = 'grab';
    }

    window.addEventListener('resize', () => { setTimeout(updateMagnifier, 100); });

    if(lensOverlay) {
        lensOverlay.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            magState.isDragging = true;
            lensOverlay.style.cursor = 'grabbing';
        });
        lensOverlay.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            magState.isDragging = true;
        }, { passive: true });
    }

    window.addEventListener('mouseup', () => {
        if(magState.isDragging) {
            magState.isDragging = false;
            if(lensOverlay) lensOverlay.style.cursor = 'grab';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (magState.isDragging && magState.enabled && currentGridResponse) {
            // Re-calculate geometry
            const rect = canvas.getBoundingClientRect();
            const gridW = currentGridResponse[0].length;
            const gridH = currentGridResponse.length;

            const pxMargin = px.drawLabels ? 25 : 0;
            const logicalW = (gridW * px.scale) + pxMargin;
            const logicalH = (gridH * px.scale) + pxMargin;
            const ratioX = rect.width / logicalW;
            const ratioY = rect.height / logicalH;

            const originX = pxMargin * ratioX;
            const originY = pxMargin * ratioY;
            const visualBlockW = px.scale * ratioX;
            const visualBlockH = px.scale * ratioY;

            const mx = e.clientX - rect.left - originX;
            const my = e.clientY - rect.top - originY;

            const gx = Math.floor(mx / visualBlockW);
            const gy = Math.floor(my / visualBlockH);

            const half = Math.floor(magState.size / 2);
            magState.x = gx - half;
            magState.y = gy - half;
            updateMagnifier();
        }
    });

    // Touch equivalent for lens drag
    window.addEventListener('touchend', () => {
        if(magState.isDragging) magState.isDragging = false;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (magState.isDragging && magState.enabled && currentGridResponse) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const gridW = currentGridResponse[0].length;
            const gridH = currentGridResponse.length;
            const pxMargin = px.drawLabels ? 25 : 0;
            const logicalW = (gridW * px.scale) + pxMargin;
            const logicalH = (gridH * px.scale) + pxMargin;
            const ratioX = rect.width / logicalW;
            const ratioY = rect.height / logicalH;
            const originX = pxMargin * ratioX;
            const originY = pxMargin * ratioY;
            const visualBlockW = px.scale * ratioX;
            const visualBlockH = px.scale * ratioY;
            const mx = touch.clientX - rect.left - originX;
            const my = touch.clientY - rect.top - originY;
            const gx = Math.floor(mx / visualBlockW);
            const gy = Math.floor(my / visualBlockH);
            const half = Math.floor(magState.size / 2);
            magState.x = gx - half;
            magState.y = gy - half;
            updateMagnifier();
        }
    }, { passive: true });

    // Bead Mode Toggle - REMOVED

    const rgbToHex = (r, g, b) => {
        const toHex = (c) => {
            const hex = c.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return ('#' + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
    };

    // Canvas Interaction
    canvas.addEventListener('mousedown', (e) => {
        if (!currentGridResponse) return;
        
        const rect = canvas.getBoundingClientRect();
        
        // Use offsetX for precise mouse position relative to element padding box
        // Map Visual Coordinates -> Internal Canvas Coordinates
        const ratioX = canvas.width / rect.width; 
        const ratioY = canvas.height / rect.height;
        
        const canvasX = e.offsetX * ratioX;
        const canvasY = e.offsetY * ratioY;
        
        const pxMargin = px.drawLabels ? 25 : 0;
        
        const x = Math.floor((canvasX - pxMargin) / px.scale);
        const y = Math.floor((canvasY - pxMargin) / px.scale);

        if (x < 0 || x >= currentGridResponse[0].length || y < 0 || y >= currentGridResponse.length) return;
        
        if (isManualEditMode) {
            const isRightClick = e.button === 2;
            let newColor;

            if (isRightClick) {
                newColor = { empty: true };
            } else {
                // Ensure newColor has both rgb and hex for stats to work
                newColor = {
                    r: currentBrush.r,
                    g: currentBrush.g,
                    b: currentBrush.b,
                    hex: rgbToHex(currentBrush.r, currentBrush.g, currentBrush.b)
                };
            }
            
            px.updatePixel(x, y, newColor);
            currentGridResponse[y][x] = newColor; 
            updateStats(currentGridResponse);
        } else {
            // Default Mode: Move Magnifier
            if (magState.enabled) {
                const half = Math.floor(magState.size / 2);
                magState.x = x - half;
                magState.y = y - half;
                updateMagnifier();
            }
        }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Touch on canvas: move magnifier on mobile
    canvas.addEventListener('touchstart', (e) => {
        if (!currentGridResponse || !magState.enabled) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const ratioX = canvas.width / rect.width;
        const ratioY = canvas.height / rect.height;
        const canvasX = (touch.clientX - rect.left) * ratioX;
        const canvasY = (touch.clientY - rect.top) * ratioY;
        const pxMargin = px.drawLabels ? 25 : 0;
        const x = Math.floor((canvasX - pxMargin) / px.scale);
        const y = Math.floor((canvasY - pxMargin) / px.scale);
        if (x < 0 || x >= currentGridResponse[0].length || y < 0 || y >= currentGridResponse.length) return;
        const half = Math.floor(magState.size / 2);
        magState.x = x - half;
        magState.y = y - half;
        updateMagnifier();
    }, { passive: true });

    // --- Stats & Completion ---

    function updateStats(grid) {
        if (!grid) return;
        
        // Remove startBeadBtn check
        // Always show editor controls when grid is generated
        document.getElementById('editorControls').style.display = 'block';
        // 显示 AI 调色卡片，重置上次结果
        const aiCard = document.getElementById('aiColorCard');
        if (aiCard) {
            aiCard.style.display = 'block';
            const resultArea = document.getElementById('aiResultArea');
            if (resultArea) resultArea.style.display = 'none';
            pendingAiGrid = null;
        }

        currentCounts = Exporter.countColors(grid);
        statsTableBody.innerHTML = '';
        
        let hasEnoughStock = true;
        const inventory = StorageService.getInventory();
        const invMap = {};
        inventory.forEach(i => invMap[i.hex.toUpperCase()] = i);

        currentCounts.forEach(c => {
            const hexUpper = c.hex.toUpperCase();
            let invItem = invMap[hexUpper];
            let stockStatus = '';
            
            const tr = document.createElement('tr');
            
            // 1. Color Box
            const colorTd = document.createElement('td');
            const colorBox = document.createElement('div');
            colorBox.style.cssText = `width: 24px; height: 24px; background-color: ${c.hex}; border: 1px solid #ccc; cursor: pointer;`;
            colorBox.title = "点击吸取颜色";
            
            colorBox.onclick = () => {
                // Fix: ensure we store simple RGB object for pixelit
                // Ensure it's compatible with px.updatePixel: expects {r, g, b, a?} or [r,g,b] depending on version
                // Looking at pixelit.js likely uses arguments or object.
                // Let's force object {r, g, b} structure which works with our save logic
                let r, g, b;
                if (Array.isArray(c.rgb)) {
                    [r, g, b] = c.rgb;
                } else {
                    r = c.rgb.r; g = c.rgb.g; b = c.rgb.b;
                }
                currentBrush = { r: parseInt(r), g: parseInt(g), b: parseInt(b) };

                const brushUI = document.getElementById('currentBrushColor');
                if (brushUI) brushUI.style.backgroundColor = c.hex;
            };
            
            colorTd.appendChild(colorBox);
            tr.appendChild(colorTd);

            // 2. Name
            const nameTd = document.createElement('td');
            let displayName = invItem ? `${invItem.name} (${invItem.id})` : c.hex;
            nameTd.innerText = displayName;
            tr.appendChild(nameTd);

            // 3. Needed Count
            const countTd = document.createElement('td');
            countTd.innerText = c.count;
            tr.appendChild(countTd);

             // 4. Stock Count
            const stockValTd = document.createElement('td');
            stockValTd.innerText = invItem ? invItem.count : '-';
            tr.appendChild(stockValTd);

             // 5. Status
            const statusTd = document.createElement('td');
            if (invItem) {
                const remaining = invItem.count - c.count;
                if (remaining < 0) {
                    statusTd.innerHTML = `<span class="badge bg-danger">缺 ${Math.abs(remaining)} 颗</span>`;
                    hasEnoughStock = false;
                } else if (remaining < 50) {
                    statusTd.innerHTML = `<span class="badge bg-warning text-dark">仅剩 ${remaining} (急需补充)</span>`;
                } else {
                    statusTd.innerHTML = `<span class="badge bg-success">充足 (余 ${remaining})</span>`;
                }
            } else {
                statusTd.innerHTML = `<span class="badge bg-secondary">未知库存</span>`;
            }
            tr.appendChild(statusTd);

            statsTableBody.appendChild(tr);
        });

        // 统计行错开入场
        statsTableBody.querySelectorAll('tr').forEach((row, i) => {
            row.classList.add('stat-row-anim');
            row.style.animationDelay = `${i * 45}ms`;
        });

        completeBtn.disabled = !hasEnoughStock;
        if (hasEnoughStock) activateStep(4);
    }

    completeBtn.addEventListener('click', async () => {
        if (!currentCounts || !currentGridResponse) return;
        if (!confirm(“确定要”拼他”吗？这将扣除对应的库存数量并保存到历史记录。”)) return;
        track('complete_bead');

        const check = StorageService.checkStock(currentCounts);
        if (!check.valid) {
            alert("库存不足，无法完成操作！请检查库存。");
            return;
        }

        StorageService.deductStock(currentCounts);
        
        const record = {
            title: "拼豆作品 " + new Date().toLocaleString(),
            imgSrc: canvas.toDataURL(), 
            beadCount: currentCounts.reduce((sum, c) => sum + c.count, 0),
            colorsUsed: currentCounts.length,
            details: currentCounts 
        };
        
        // Wait for ID to be generated before rendering
        await StorageService.addHistory(record);

        renderInventoryTable();
        renderHistoryList();
        updateStats(currentGridResponse);
        alert("🎉 恭喜！作品已保存，库存已更新。");
    });

    // --- History Logic Refactored ---
    const renderHistoryList = () => {
        // Sort history: newest first
        const history = StorageService.getHistory().sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<div class="col-12 text-center text-muted">暂无历史记录</div>';
            return;
        }
        
        const row = document.createElement('div');
        row.className = 'row g-3'; // Use bootstrap grid

        history.forEach(rec => {
            const col = document.createElement('div');
            col.className = 'col-md-4 col-sm-6'; // Adjust column width

            col.innerHTML = `
                <div class="card h-100 shadow-sm">
                    <div style="position: relative;">
                         <img src="${rec.imgSrc}" class="card-img-top p-2" alt="Thumb" style="image-rendering: pixelated; max-height: 200px; object-fit: contain; background: #eee;">
                         <span class="badge bg-dark bg-opacity-75 position-absolute top-0 end-0 m-2">${new Date(rec.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div class="card-body d-flex flex-column">
                        <h6 class="card-title fw-bold text-truncate" title="${rec.title}">${rec.title || '未命名作品'}</h6>
                        <ul class="list-unstyled flex-grow-1 small text-muted mb-3">
                            <li class="d-flex justify-content-between border-bottom py-1"><span>消耗豆子:</span> <strong>${rec.beadCount} 颗</strong></li>
                            <li class="d-flex justify-content-between py-1"><span>使用颜色:</span> <strong>${rec.colorsUsed} 种</strong></li>
                        </ul>
                        <div class="d-grid mt-auto">
                            <button class="btn btn-outline-danger btn-sm delete-history-btn" data-id="${rec.id}">
                                🗑️ 删除并撤销库存
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            const btn = col.querySelector('.delete-history-btn');
            btn.addEventListener('click', async () => {
                if(!confirm(`⚠️ 严重警告：\n\n您确定要删除这条【${rec.title || '未命名'}】记录吗？\n\n操作后果：\n1. 该作品的记录将被永久删除。\n2. 系统将尝试把该作品消耗的豆子【全部退回】到库存中。\n\n请确认：这些豆子确实没有被消耗掉，或者您只是想撤销这次操作。`)) {
                    return;
                }
                
                // Do deletion sequence
                try {
                    // 1. Restore Stock
                    const stockResult = await StorageService.restoreStockFromHistory(rec);
                    
                    if (!stockResult.success) {
                        if (stockResult.reason === 'missing_details') {
                            if (!confirm("⚠️ 注意：该历史记录似乎是一个早期生成的数据（缺少详细消耗清单），系统【无法自动回滚】库存。\n\n您是否仍要删除这条历史记录？")) {
                                return; // User cancelled deletion
                            }
                        } else {
                            alert("库存回滚遭遇未知错误，操作中止。");
                            return;
                        }
                    } else {
                        // Success restoring
                        if(stockResult.restoredCount > 0) {
                             alert(`库存回滚成功！已退回 ${stockResult.restoredCount} 颗豆子。`);
                        }
                    }

                    // 2. Delete Record
                    const success = await StorageService.deleteHistory(rec);
                    
                    if (success) {
                        renderHistoryList(); // Re-render self
                        renderInventoryTable(); // Refresh inventory tab incase user switches back
                        // Optionally update stats table if it matches current grid? No need, too complex.
                    }
                } catch(err) {
                    console.error(err);
                    alert("操作执行过程中发生错误，请刷新页面检查数据。");
                }
            });
            
            row.appendChild(col);
        });
        historyList.appendChild(row);
    };

    // --- Exports ---
    
    btnPng.addEventListener('click', () => {
        if (!currentGridResponse) return alert('请先生成图纸');
        track('export_png');
        
        const opts = {
            showNumbers: chkNumbers.checked,
            cellSize: 20
        };
        const printCanvas = Exporter.generatePrintableCanvas(currentGridResponse, opts);
        
        printCanvas.toBlob(blob => {
            const link = document.createElement('a');
            link.download = `pixelbeads_design_${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
        });
    });

    btnCsv.addEventListener('click', () => {
        if (!currentGridResponse) return alert('请先生成图纸');
        Exporter.exportGridCSV(currentGridResponse);
    });

    btnStats.addEventListener('click', () => {
        if (!currentCounts) return alert('请先生成图纸');
        Exporter.exportColorUsageCSV(currentCounts);
    });

    // --- AI 调色 ---

    const aiColorCard      = document.getElementById('aiColorCard');
    const aiColorizeBtn    = document.getElementById('aiColorizeBtn');
    const aiResultArea     = document.getElementById('aiResultArea');
    const aiReasonText     = document.getElementById('aiReasonText');
    const aiBeforeCanvas   = document.getElementById('aiBeforeCanvas');
    const aiAfterCanvas    = document.getElementById('aiAfterCanvas');
    const aiAcceptBtn      = document.getElementById('aiAcceptBtn');
    const aiRejectBtn      = document.getElementById('aiRejectBtn');

    let pendingAiGrid = null;
    let selectedAiStyle = 'simple';

    // 风格按钮切换
    document.querySelectorAll('.ai-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ai-style-btn').forEach(b => {
                b.classList.remove('active-style');
                b.style.border = '1px solid #ccc';
                b.style.color = 'var(--mo-text)';
                b.style.background = '';
            });
            btn.classList.add('active-style');
            btn.style.border = '';
            btn.style.color = '';
            selectedAiStyle = btn.dataset.style;
        });
    });

    // 渲染小尺寸对比预览 canvas（不含坐标标签）
    function renderPreviewCanvas(targetCanvas, grid) {
        const cols = grid[0].length;
        const rows = grid.length;
        const maxW = 220;
        const scale = Math.max(1, Math.floor(maxW / cols));
        targetCanvas.width  = cols * scale;
        targetCanvas.height = rows * scale;
        const ctx = targetCanvas.getContext('2d');
        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const p = grid[y][x];
                if (p && !p.empty) {
                    ctx.fillStyle = p.hex || rgbToHex(p.r, p.g, p.b);
                    ctx.fillRect(x * scale, y * scale, scale, scale);
                }
            }
        }
    }

    // 按替换表生成新 grid（deep copy + 替换）
    function applyColorReplacements(grid, replacements) {
        return grid.map(row => row.map(pixel => {
            if (!pixel || pixel.empty) return pixel ? { ...pixel } : pixel;
            const hexKey = (pixel.hex || rgbToHex(pixel.r, pixel.g, pixel.b)).toUpperCase();
            const newHex = replacements[hexKey];
            if (newHex) {
                const r = parseInt(newHex.slice(1, 3), 16);
                const g = parseInt(newHex.slice(3, 5), 16);
                const b = parseInt(newHex.slice(5, 7), 16);
                return { ...pixel, r, g, b, hex: newHex };
            }
            return { ...pixel };
        }));
    }

    if (aiColorizeBtn) {
        aiColorizeBtn.addEventListener('click', async () => {
            if (!currentGridResponse) return;

            const originalHTML = aiColorizeBtn.innerHTML;
            aiColorizeBtn.innerHTML = '<span class="btn-spinner"></span>AI 分析中...';
            aiColorizeBtn.disabled = true;
            aiResultArea.style.display = 'none';
            pendingAiGrid = null;
            track('ai_colorize_start', { style: selectedAiStyle });

            try {
                const imageBase64 = canvas.toDataURL('image/png');
                // 原始图片（sourceImage.src 已经是 base64 data URL）
                const originalImageBase64 = sourceImage.src || null;
                const colorCounts = Exporter.countColors(currentGridResponse);
                const colors = colorCounts.map(c => ({
                    hex: c.hex.toUpperCase(),
                    count: c.count
                }));

                const resp = await fetch('/api/ai/colorize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64, originalImageBase64, colors, style: selectedAiStyle })
                });

                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || '请求失败');

                const { replacements } = data;
                const changedCount = Object.keys(replacements).length;

                if (changedCount === 0) {
                    aiReasonText.textContent = 'AI 认为当前配色已很好，无需调整。';
                } else {
                    // 统计合并后的颜色数
                    const afterColors = new Set(
                        colorCounts.map(c => replacements[c.hex.toUpperCase()] || c.hex.toUpperCase())
                    );
                    aiReasonText.textContent = `AI 建议将 ${changedCount} 种颜色合并替换，颜色总数从 ${colorCounts.length} 种减少为 ${afterColors.size} 种。`;
                }

                pendingAiGrid = applyColorReplacements(currentGridResponse, replacements);
                renderPreviewCanvas(aiBeforeCanvas, currentGridResponse);
                renderPreviewCanvas(aiAfterCanvas, pendingAiGrid);
                aiResultArea.style.display = 'block';

            } catch (err) {
                alert('AI 调色失败：' + err.message);
            } finally {
                aiColorizeBtn.innerHTML = originalHTML;
                aiColorizeBtn.disabled = false;
            }
        });
    }

    if (aiAcceptBtn) {
        aiAcceptBtn.addEventListener('click', () => {
            if (!pendingAiGrid) return;
            track('ai_colorize_accept');
            currentGridResponse = pendingAiGrid;
            pendingAiGrid = null;
            px.drawGrid(currentGridResponse);
            updateStats(currentGridResponse);
            aiResultArea.style.display = 'none';
        });
    }

    if (aiRejectBtn) {
        aiRejectBtn.addEventListener('click', () => {
            track('ai_colorize_reject');
            pendingAiGrid = null;
            aiResultArea.style.display = 'none';
        });
    }

    // Boot
    // init();
    loginModal.show();
});
