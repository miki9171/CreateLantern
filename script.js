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
            textOverlay.style.width = `${imageCanvas.width}px`;
            textOverlay.style.height = `${imageCanvas.height}px`;
            
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
        const textValue = textInput.value.trim() || 'ここにテキストを挿入してください';
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
            
            // タッチ開始時にドラッグを開始
            startDrag(e);
        }
        
        function handleTouchEnd(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const touchEndTime = Date.now();
            const touchDuration = touchEndTime - touchStartTime;
            
            // 短いタップの場合は編集モードに入る
            if (touchDuration < 300 && !isDragging) {
                handleDoubleClick(e);
            }
        }
        
        function handleDoubleClick(e) {
            e.preventDefault();
            e.stopPropagation();
            
            isEditing = true;
            element.focus();
            
            // テキストを全選択
            const range = document.createRange();
            range.selectNodeContents(element);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        function startDrag(e) {
            isDragging = true;
            selectTextElement(element);
            
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
    
    // プレビュー外でのタッチ操作を無効化
    document.addEventListener('touchmove', (e) => {
        if (isDragging) {
            e.preventDefault();
        }
    }, { passive: false });

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
        
        // 元画像のアスペクト比を計算
        const originalAspectRatio = uploadedImage.width / uploadedImage.height;
        
        // プレビューのサイズを取得
        const canvasContainer = document.querySelector('.canvas-container');
        const containerRect = canvasContainer.getBoundingClientRect();
        
        // アスペクト比を保持したキャンバスサイズを計算
        let canvasWidth, canvasHeight;
        
        if (containerRect.width / containerRect.height > originalAspectRatio) {
            // コンテナが横長の場合、高さに合わせる
            canvasHeight = containerRect.height;
            canvasWidth = containerRect.height * originalAspectRatio;
        } else {
            // コンテナが縦長の場合、幅に合わせる
            canvasWidth = containerRect.width;
            canvasHeight = containerRect.width / originalAspectRatio;
        }
        
        // 一時キャンバスを作成（アスペクト比を保持）
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasWidth;
        tempCanvas.height = canvasHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 元の画像をアスペクト比を保持して描画
        tempCtx.drawImage(uploadedImage, 0, 0, canvasWidth, canvasHeight);
        
        // スケール係数を計算（プレビューと実際のキャンバスの比率）
        const scaleX = canvasWidth / containerRect.width;
        const scaleY = canvasHeight / containerRect.height;
        
        // テキスト要素を描画（座標をスケール調整）
        textElements.forEach(textData => {
            tempCtx.font = `${textData.size} ${textData.font}`;
            tempCtx.fillStyle = textData.color;
            
            // テキスト位置を取得
            const element = document.getElementById(textData.id);
            let x = textData.x * scaleX;
            let y = textData.y * scaleY;
            
            // フォントサイズもスケール調整
            const scaledFontSize = parseInt(textData.size) * scaleX;
            tempCtx.font = `${scaledFontSize}px ${textData.font}`;
            
            // 中央揃えの場合は位置を調整
            if (element && textData.hasInitialTransform) {
                // 中央揃えされているテキストの場合、位置を調整
                y = y + scaledFontSize * 0.3; // フォントサイズに合わせて微調整
            } else {
                // 通常の場合はフォントサイズに合わせて微調整
                y = y + scaledFontSize * 0.7;
            }
            
            tempCtx.fillText(textData.text, x, y);
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