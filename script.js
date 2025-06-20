document.addEventListener('DOMContentLoaded', () => {
    // DOM要素
    const imageCanvas = document.getElementById('imageCanvas');
    const ctx = imageCanvas.getContext('2d');
    const textOverlay = document.getElementById('textOverlay');
    const textInput = document.getElementById('textInput');
    const fontSize = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const fontColor = document.getElementById('fontColor');
    const fontFamily = document.getElementById('fontFamily');
    const addTextBtn = document.getElementById('addTextBtn');
    const saveImageBtn = document.getElementById('saveImageBtn');
    const textItemsList = document.getElementById('textItemsList');
    const editorContainer = document.getElementById('editorContainer');

    // 状態変数
    let uploadedImage = null;
    let textElements = [];
    let selectedTextElement = null;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let nextTextId = 1;
    let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let touchStartTime = 0;
    let touchStartPosition = { x: 0, y: 0 };
    let longPressTimer = null;
    let longPressDelay = 600; // 長押しの判定時間（ミリ秒）

    // 初期状態ではエディタコンテナを非表示
    editorContainer.style.display = 'none';

    // フォントサイズの値の表示を更新
    fontSize.addEventListener('input', () => {
        fontSizeValue.textContent = `${fontSize.value}px`;
    });

    // lantern2.pngを自動的に読み込む
    function loadLanternImage() {
        const img = new Image();
        img.onload = () => {
            uploadedImage = img;
            
            // キャンバスサイズを画像に合わせる
            imageCanvas.width = img.width;
            imageCanvas.height = img.height;
            
            // 画像をキャンバスに描画
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
            ctx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
            
            // エディタコンテナを表示
            editorContainer.style.display = 'flex';
            
            // テキストオーバーレイのサイズを調整
            // コンテナサイズに合わせる（統一）
            const containerRect = document.querySelector('.canvas-container').getBoundingClientRect();
            textOverlay.style.width = `${containerRect.width}px`;
            textOverlay.style.height = `${containerRect.height}px`;
            
            // 保存ボタンを有効化
            saveImageBtn.disabled = false;
        };
        img.src = 'lantern2.png';
    }

    // ページ読み込み時にlantern2.pngを読み込む
    loadLanternImage();

    // タッチイベントの座標を取得する関数
    function getEventCoordinates(event) {
        if (event.touches && event.touches.length > 0) {
            return {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
        }
        return {
            x: event.clientX,
            y: event.clientY
        };
    }

    // テキスト要素を追加
    addTextBtn.addEventListener('click', () => {
        const textValue = textInput.value.trim() || 'Sample';
        const textSize = `${fontSize.value}px`;
        const textFont = fontFamily.value;
        const textColorValue = fontColor.value;
        
        // テキスト要素を作成
        const textElement = document.createElement('div');
        const textId = `text-${nextTextId++}`;
        
        textElement.id = textId;
        textElement.className = 'text-element editable';
        textElement.contentEditable = true;
        textElement.textContent = textValue;
        textElement.style.fontSize = textSize;
        textElement.style.fontFamily = textFont;
        textElement.style.color = textColorValue;
        
        // キャンバスコンテナの中心座標を取得
        const canvasContainer = document.querySelector('.canvas-container');
        const containerRect = canvasContainer.getBoundingClientRect();
        
        // コンテナの中心座標を使用（統一）
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        
        // 位置を中央に設定（transformを使用して中央揃え）
        textElement.style.left = `${centerX}px`;
        textElement.style.top = `${centerY}px`;
        textElement.style.transform = 'translate(-50%, -50%)';
        
        // テキスト要素をオーバーレイに追加
        textOverlay.appendChild(textElement);
        
        // テキスト要素のデータを保存
        const newTextData = {
            id: textId,
            text: textValue,
            size: textSize,
            font: textFont,
            color: textColorValue,
            x: centerX,
            y: centerY,
            hasInitialTransform: true
        };
        
        textElements.push(newTextData);
        
        // テキストリストに追加
        updateTextItemsList();
        
        // テキスト入力をクリア
        textInput.value = '';
        
        // ドラッグイベントを設定
        setupDragEvents(textElement);
        
        // 要素を選択状態にする
        selectTextElement(textElement);
        
        // テキストボックスにフォーカスを当てる
        textElement.focus();
        
        // テキストを全選択
        const range = document.createRange();
        range.selectNodeContents(textElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });

    // テキスト要素を選択
    function selectTextElement(element) {
        // 以前に選択された要素から選択状態を解除
        if (selectedTextElement) {
            selectedTextElement.classList.remove('active');
        }
        
        // 新しい要素を選択状態にする
        selectedTextElement = element;
        if (selectedTextElement) {
            selectedTextElement.classList.add('active');
            
            // 選択要素のスタイルをコントロールパネルに反映
            const textData = textElements.find(item => item.id === selectedTextElement.id);
            if (textData) {
                fontSize.value = parseInt(textData.size);
                fontSizeValue.textContent = textData.size;
                fontFamily.value = textData.font;
                fontColor.value = textData.color;
            }
        }
    }

    // ドラッグイベントの設定
    function setupDragEvents(element) {
        let isEditing = false;
        let touchStartTime = 0;
        let touchStartPosition = { x: 0, y: 0 };
        
        // マウスイベント
        element.addEventListener('mousedown', handleStart);
        element.addEventListener('dblclick', handleDoubleClick);
        
        // タッチイベント
        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });
        
        function handleStart(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (isEditing) return;
            
            startDrag(e);
        }
        
        function handleTouchStart(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (isEditing) return;
            
            const touch = e.touches[0];
            touchStartTime = Date.now();
            touchStartPosition = { x: touch.clientX, y: touch.clientY };
            
            // 長押しタイマーを開始
            longPressTimer = setTimeout(() => {
                handleLongPress(e);
            }, longPressDelay);
            
            // タッチ開始時にドラッグを開始
            startDrag(e);
        }
        
        function handleTouchEnd(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // 長押しタイマーをクリア
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            const touchEndTime = Date.now();
            const touchDuration = touchEndTime - touchStartTime;
            const touchDistance = Math.sqrt(
                Math.pow(e.changedTouches[0].clientX - touchStartPosition.x, 2) +
                Math.pow(e.changedTouches[0].clientY - touchStartPosition.y, 2)
            );
            
            // 短いタップで移動距離が少ない場合は編集モードに入る
            if (touchDuration < 500 && touchDistance < 10 && !isDragging) {
                handleDoubleClick(e);
            }
        }
        
        function handleLongPress(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // 長押しで編集モードに入る
            isEditing = true;
            element.focus();
            
            // 長押しの視覚的フィードバック
            element.style.transform = 'scale(1.05)';
            element.style.boxShadow = '0 0 10px rgba(52, 152, 219, 0.8)';
            
            // 少し遅延を入れてからテキストを全選択
            setTimeout(() => {
                const range = document.createRange();
                range.selectNodeContents(element);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                
                // 長押しの視覚的フィードバックを解除
                element.style.transform = '';
                element.style.boxShadow = '';
            }, 100);
        }
        
        function handleDoubleClick(e) {
            e.preventDefault();
            e.stopPropagation();
            
            isEditing = true;
            element.focus();
            
            // 少し遅延を入れてからテキストを全選択（モバイルでの安定性のため）
            setTimeout(() => {
                const range = document.createRange();
                range.selectNodeContents(element);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }, 100);
        }
        
        function startDrag(e) {
            isDragging = true;
            selectTextElement(element);
            
            // ドラッグ開始時に長押しタイマーをクリア
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            const coords = getEventCoordinates(e);
            const overlayRect = textOverlay.getBoundingClientRect();
            
            // テキストデータを取得
            const textData = textElements.find(item => item.id === element.id);
            
            // マウス位置と要素位置の差分を計算（より正確に）
            const elementLeft = parseFloat(element.style.left) || 0;
            const elementTop = parseFloat(element.style.top) || 0;
            
            // transformが適用されている場合の実際の位置を考慮
            if (textData && textData.hasInitialTransform) {
                dragOffsetX = coords.x - (overlayRect.left + elementLeft);
                dragOffsetY = coords.y - (overlayRect.top + elementTop);
            } else {
                dragOffsetX = coords.x - (overlayRect.left + elementLeft);
                dragOffsetY = coords.y - (overlayRect.top + elementTop);
            }
            
            // 初回ドラッグ時にtransformを解除する
            if (textData && textData.hasInitialTransform) {
                // 現在の座標を取得して位置を調整（transformを解除するため）
                const currentX = parseFloat(element.style.left);
                const currentY = parseFloat(element.style.top);
                
                // 要素の実際の寸法を考慮した位置調整
                element.style.transform = 'none';
                element.style.left = `${currentX - element.offsetWidth / 2}px`;
                element.style.top = `${currentY - element.offsetHeight / 2}px`;
                
                // テキストデータも更新
                textData.x = currentX - element.offsetWidth / 2;
                textData.y = currentY - element.offsetHeight / 2;
                textData.hasInitialTransform = false;
                
                // ドラッグオフセットも再計算
                dragOffsetX = coords.x - (overlayRect.left + textData.x);
                dragOffsetY = coords.y - (overlayRect.top + textData.y);
            }
        }
        
        // フォーカスアウト時に編集モードを終了
        element.addEventListener('blur', () => {
            isEditing = false;
            const textData = textElements.find(item => item.id === element.id);
            if (textData) {
                textData.text = element.textContent;
                updateTextItemsList();
            }
        });
        
        // テキスト内容の変更を監視
        element.addEventListener('input', () => {
            const textData = textElements.find(item => item.id === element.id);
            if (textData) {
                textData.text = element.textContent;
                updateTextItemsList();
            }
        });
    }

    // マウスとタッチの移動を追跡
    function handleMove(e) {
        if (!isDragging || !selectedTextElement) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const coords = getEventCoordinates(e);
        const overlayRect = textOverlay.getBoundingClientRect();
        
        // プレビュー内でのみドラッグを許可
        if (coords.x < overlayRect.left || coords.x > overlayRect.right ||
            coords.y < overlayRect.top || coords.y > overlayRect.bottom) {
            return;
        }
        
        // 新しい位置を計算
        const newX = coords.x - overlayRect.left - dragOffsetX;
        const newY = coords.y - overlayRect.top - dragOffsetY;
        
        // プレビュー内に制限
        const maxX = overlayRect.width - selectedTextElement.offsetWidth;
        const maxY = overlayRect.height - selectedTextElement.offsetHeight;
        
        const clampedX = Math.max(0, Math.min(newX, maxX));
        const clampedY = Math.max(0, Math.min(newY, maxY));
        
        // 要素の位置を更新
        selectedTextElement.style.left = `${clampedX}px`;
        selectedTextElement.style.top = `${clampedY}px`;
        
        // データを更新
        const textData = textElements.find(item => item.id === selectedTextElement.id);
        if (textData) {
            textData.x = clampedX;
            textData.y = clampedY;
        }
    }

    // ドラッグ終了処理
    function handleEnd() {
        isDragging = false;
    }

    // イベントリスナーの設定（プレビュー内でのみ）
    textOverlay.addEventListener('mousemove', handleMove);
    textOverlay.addEventListener('mouseup', handleEnd);
    textOverlay.addEventListener('touchmove', handleMove, { passive: false });
    textOverlay.addEventListener('touchend', handleEnd, { passive: false });
    
    // プレビュー外でのタッチ操作を無効化（ドラッグ中のみ）
    document.addEventListener('touchmove', (e) => {
        if (isDragging) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // コントロールパネルでのイベント伝播を防止
    const controlPanel = document.querySelector('.control-panel');
    controlPanel.addEventListener('touchstart', (e) => {
        e.stopPropagation();
    }, { passive: true });
    
    controlPanel.addEventListener('touchmove', (e) => {
        e.stopPropagation();
    }, { passive: true });
    
    controlPanel.addEventListener('touchend', (e) => {
        e.stopPropagation();
    }, { passive: true });
    
    // スライダーのタッチ操作を最適化
    const rangeInputs = document.querySelectorAll('input[type="range"]');
    rangeInputs.forEach(input => {
        input.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });
        
        input.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });
        
        input.addEventListener('touchend', (e) => {
            e.stopPropagation();
        }, { passive: true });
    });

    // テキストリストの更新
    function updateTextItemsList() {
        textItemsList.innerHTML = '';
        
        textElements.forEach(textData => {
            const listItem = document.createElement('li');
            listItem.className = 'text-item';
            
            const textContent = document.createElement('div');
            textContent.className = 'text-item-content';
            textContent.textContent = textData.text;
            
            const actionButtons = document.createElement('div');
            actionButtons.className = 'text-item-actions';
            
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '削除';
            deleteButton.addEventListener('click', () => {
                const element = document.getElementById(textData.id);
                if (element) {
                    element.remove();
                    textElements = textElements.filter(item => item.id !== textData.id);
                    updateTextItemsList();
                    
                    if (selectedTextElement && selectedTextElement.id === textData.id) {
                        selectedTextElement = null;
                        textInput.value = '';
                    }
                }
            });
            
            actionButtons.appendChild(deleteButton);
            
            listItem.appendChild(textContent);
            listItem.appendChild(actionButtons);
            
            textItemsList.appendChild(listItem);
        });
    }

    // 画像を保存
    saveImageBtn.addEventListener('click', () => {
        if (!uploadedImage) {
            alert('画像が読み込まれていません。');
            return;
        }
        
        // プレビューの範囲を取得
        const canvasContainer = document.querySelector('.canvas-container');
        const containerRect = canvasContainer.getBoundingClientRect();
        
        // プレビュー範囲と同じサイズのキャンバスを作成
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = containerRect.width;
        tempCanvas.height = containerRect.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 元画像のアスペクト比を計算
        const originalAspectRatio = uploadedImage.width / uploadedImage.height;
        
        // プレビュー範囲に画像をフィットして描画
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
        
        if (containerRect.width / containerRect.height > originalAspectRatio) {
            // コンテナが横長の場合、高さに合わせる
            drawHeight = containerRect.height;
            drawWidth = containerRect.height * originalAspectRatio;
            offsetX = (containerRect.width - drawWidth) / 2;
        } else {
            // コンテナが縦長の場合、幅に合わせる
            drawWidth = containerRect.width;
            drawHeight = containerRect.width / originalAspectRatio;
            offsetY = (containerRect.height - drawHeight) / 2;
        }
        
        // 背景色を設定（画像の周りの空白部分）
        tempCtx.fillStyle = '#eee';
        tempCtx.fillRect(0, 0, containerRect.width, containerRect.height);
        
        // 画像を描画
        tempCtx.drawImage(uploadedImage, offsetX, offsetY, drawWidth, drawHeight);
        
        // テキスト要素を描画（プレビューと同じ座標系）
        textElements.forEach(textData => {
            const element = document.getElementById(textData.id);
            if (!element) return;
            
            // テキストボックスの中心座標を取得
            const elementRect = element.getBoundingClientRect();
            const containerRect = canvasContainer.getBoundingClientRect();
            
            // プレビュー内での相対座標を計算
            let centerX, centerY;
            
            if (textData.hasInitialTransform) {
                // transformが適用されている場合（初期位置）
                // 保存された座標をそのまま使用
                centerX = textData.x;
                centerY = textData.y;
            } else {
                // ドラッグで移動された場合
                // 実際の表示位置から計算
                centerX = elementRect.left + elementRect.width / 2 - containerRect.left;
                centerY = elementRect.top + elementRect.height / 2 - containerRect.top;
            }
            
            // フォントサイズを取得（実際の表示サイズ）
            const computedStyle = window.getComputedStyle(element);
            const fontSize = parseFloat(computedStyle.fontSize);
            
            // テキストを描画
            tempCtx.font = `${fontSize}px ${textData.font}`;
            tempCtx.fillStyle = textData.color;
            tempCtx.textAlign = 'center';
            tempCtx.textBaseline = 'middle';
            
            tempCtx.fillText(textData.text, centerX, centerY);
        });
        
        // 画像をダウンロード
        const link = document.createElement('a');
        link.download = '10thLantern.png';
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    });

    // テキスト設定の変更を監視して選択中の要素に反映
    [fontSize, fontFamily, fontColor].forEach(control => {
        control.addEventListener('input', () => {
            if (!selectedTextElement) return;
            
            const textData = textElements.find(item => item.id === selectedTextElement.id);
            if (!textData) return;
            
            // フォントサイズの更新
            if (control === fontSize) {
                const newSize = `${fontSize.value}px`;
                selectedTextElement.style.fontSize = newSize;
                textData.size = newSize;
            }
            
            // フォントファミリーの更新
            if (control === fontFamily) {
                selectedTextElement.style.fontFamily = fontFamily.value;
                textData.font = fontFamily.value;
            }
            
            // フォントカラーの更新
            if (control === fontColor) {
                selectedTextElement.style.color = fontColor.value;
                textData.color = fontColor.value;
            }
            
            // リストを更新
            updateTextItemsList();
        });
    });
}); 