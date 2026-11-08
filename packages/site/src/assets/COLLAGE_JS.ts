/** The collage page script: filters the items by date and type and renders the cover grid, from the theme. */
export const COLLAGE_JS = String.raw`    let allMedia = [];

    const canvas = document.getElementById('collage-canvas');
    const scaler = document.querySelector('.canvas-scaler');
    const previewArea = document.querySelector('.collage-preview-area');
    const controlsPanel = document.getElementById('collage-controls-panel');
    const toggleBtn = document.getElementById('controls-toggle');
    const toggleLabel = document.getElementById('toggle-label');

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const columnsInput = document.getElementById('columns-range');
    const colValDisplay = document.getElementById('col-val');
    const countDisplay = document.getElementById('count-display');

    // Set default columns based on screen width
    if (window.innerWidth <= 768) {
        columnsInput.value = 3;
    }

    // Controls toggle for mobile
    toggleBtn.addEventListener('click', function() {
        const collapsed = controlsPanel.classList.toggle('is-collapsed');
        toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        toggleLabel.textContent = collapsed ? 'Show Controls' : 'Hide Controls';
    });

    fetch(document.body.getAttribute('data-index'))
        .then(response => response.json())
        .then(data => {
            allMedia = data;

            const today = new Date();
            const startOfYear = new Date(today.getFullYear(), 0, 2);
            startDateInput.valueAsDate = startOfYear;
            endDateInput.valueAsDate = today;

            renderCollage();

            window.addEventListener('resize', fitPreviewToScreen);
        });

    function renderCollage() {
        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);

        let columns = parseInt(columnsInput.value);

        const checkedTypes = Array.from(document.querySelectorAll('.checkbox-wrapper input:checked')).map(cb => cb.value);

        if (checkedTypes.includes("tv")) {
            checkedTypes.push("season");
        }

        const filtered = allMedia.filter(item => {
            if (!checkedTypes.includes(item.type)) return false;

            if (item.date) {
                const itemDate = new Date(item.date);
                const endOfDay = new Date(end);
                endOfDay.setHours(23, 59, 59);
                return itemDate >= start && itemDate <= endOfDay;
            }
            return false;
        });

        if (filtered.length > 0 && filtered.length < columns) {
            columns = filtered.length;
        }

        countDisplay.innerText = filtered.length;
        colValDisplay.innerText = columnsInput.value;

        const isMobile = window.innerWidth <= 768;
        const itemWidth = isMobile
            ? Math.floor((previewArea.clientWidth - 32) / columns)
            : 600;

        canvas.style.gridTemplateColumns = 'repeat(' + columns + ', ' + itemWidth + 'px)';
        canvas.innerHTML = '';

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'collage-item';
            div.style.width = itemWidth + 'px';
            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.title;
            img.crossOrigin = 'anonymous';
            img.loading = 'eager';
            div.appendChild(img);
            canvas.appendChild(div);
        });

        if (isMobile) {
            scaler.style.transform = 'none';
        } else {
            setTimeout(fitPreviewToScreen, 100);
        }
    }

    function fitPreviewToScreen() {
        if (!canvas.firstChild || window.innerWidth <= 768) return;

        const containerWidth = previewArea.clientWidth - 32;
        const containerHeight = previewArea.clientHeight - 32;

        const contentWidth = canvas.scrollWidth;
        const contentHeight = canvas.scrollHeight;

        const scaleX = containerWidth / contentWidth;
        const scaleY = containerHeight / contentHeight;

        let scale = Math.min(scaleX, scaleY);

        if (scale > 1) scale = 1;

        scaler.style.transform = 'scale(' + scale + ')';
    }

    [startDateInput, endDateInput, columnsInput].forEach(el => {
        el.addEventListener('change', renderCollage);
        el.addEventListener('input', renderCollage);
    });

    document.querySelectorAll('.checkbox-wrapper input').forEach(el => {
        el.addEventListener('change', renderCollage);
    });

    document.getElementById('download-btn').addEventListener('click', () => {
        const btn = document.getElementById('download-btn');
        const originalText = btn.innerHTML;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        btn.disabled = true;

        html2canvas(canvas, {
            useCORS: true,
            allowTaint: true,
            scale: 1,
            backgroundColor: null,
            logging: false,
            onclone: (clonedDoc) => {
                const clonedCanvas = clonedDoc.getElementById('collage-canvas');
                const clonedScaler = clonedDoc.querySelector('.canvas-scaler');

                if(clonedScaler) {
                    clonedScaler.style.transform = 'none';
                    clonedScaler.style.margin = '0';
                    clonedScaler.style.padding = '0';
                }

                clonedCanvas.style.overflow = 'visible';
                clonedCanvas.style.maxWidth = 'none';
                clonedCanvas.style.height = 'auto';
            }
        }).then(renderedCanvas => {
            renderedCanvas.toBlob(function(blob) {
                if (!blob) {
                    alert("Error: Image is too large for the browser.");
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    return;
                }

                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = 'collage_' + new Date().toISOString().slice(0, 10) + '.png';
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                setTimeout(() => URL.revokeObjectURL(url), 1000);

                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 'image/png');

        }).catch(err => {
            console.error("Canvas Error:", err);
            btn.innerHTML = 'Error :(';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
        });
    });

`;
