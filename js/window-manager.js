export class WindowManager {
    constructor(onResize) {
        this.panels = new Map();
        this.topZ = 1000;
        this.onResize = onResize;
        this.dragState = null;
        this.resizeState = null;

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    register(panelId, title) {
        const el = document.getElementById(panelId);
        if (!el) return;

        const header = el.querySelector('.panel-header');
        const actionsDiv = header.querySelector('.panel-actions');

        const floatBtn = this.createIconButton('float', 'Undock Panel',
            '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>');
        const maxBtn = this.createIconButton('maximize', 'Maximize',
            '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>');
        const restoreBtn = this.createIconButton('restore', 'Restore',
            '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>');
        restoreBtn.style.display = 'none';

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        el.appendChild(resizeHandle);

        actionsDiv.insertBefore(restoreBtn, actionsDiv.firstChild);
        actionsDiv.insertBefore(maxBtn, actionsDiv.firstChild);
        actionsDiv.insertBefore(floatBtn, actionsDiv.firstChild);

        const panelData = {
            id: panelId,
            el,
            title,
            header,
            floatBtn,
            maxBtn,
            restoreBtn,
            resizeHandle,
            mode: 'docked',
            floatRect: null,
            placeholder: null
        };

        this.panels.set(panelId, panelData);

        floatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFloat(panelId);
        });
        maxBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMaximize(panelId);
        });
        restoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.restore(panelId);
        });

        header.addEventListener('dblclick', (e) => {
            if (e.target.closest('.icon-btn') || e.target.closest('.wm-btn')) return;
            if (panelData.mode === 'docked') {
                this.toggleMaximize(panelId);
            } else if (panelData.mode === 'maximized') {
                this.restore(panelId);
            }
        });

        header.addEventListener('mousedown', (e) => {
            if (panelData.mode !== 'floating') return;
            if (e.target.closest('.icon-btn') || e.target.closest('.wm-btn') || e.target.closest('input') || e.target.closest('span.nn-info')) return;
            e.preventDefault();
            this.bringToFront(panelId);
            this.dragState = {
                panelId,
                startX: e.clientX,
                startY: e.clientY,
                startLeft: el.offsetLeft,
                startTop: el.offsetTop
            };
        });

        resizeHandle.addEventListener('mousedown', (e) => {
            if (panelData.mode !== 'floating') return;
            e.preventDefault();
            e.stopPropagation();
            this.bringToFront(panelId);
            this.resizeState = {
                panelId,
                startX: e.clientX,
                startY: e.clientY,
                startW: el.offsetWidth,
                startH: el.offsetHeight
            };
        });
    }

    createIconButton(action, title, svgPath) {
        const btn = document.createElement('button');
        btn.className = 'icon-btn wm-btn';
        btn.title = title;
        btn.dataset.wmAction = action;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${svgPath}</svg>`;
        return btn;
    }

    toggleFloat(panelId) {
        const p = this.panels.get(panelId);
        if (!p) return;

        if (p.mode === 'floating') {
            this.restore(panelId);
            return;
        }

        if (p.mode === 'maximized') {
            this.restore(panelId);
        }

        const rect = p.el.getBoundingClientRect();

        const placeholder = document.createElement('div');
        placeholder.className = 'panel-placeholder';
        placeholder.dataset.panelId = panelId;
        if (p.el.id === 'control-panel') {
            placeholder.style.width = getComputedStyle(p.el).width;
        }
        p.el.parentNode.insertBefore(placeholder, p.el);
        p.placeholder = placeholder;

        document.body.appendChild(p.el);

        const floatW = Math.max(400, rect.width * 0.8);
        const floatH = Math.max(300, rect.height * 0.7);
        const floatX = Math.min(rect.left + 20, window.innerWidth - floatW - 20);
        const floatY = Math.min(rect.top + 20, window.innerHeight - floatH - 20);

        p.el.style.position = 'fixed';
        p.el.style.left = floatX + 'px';
        p.el.style.top = floatY + 'px';
        p.el.style.width = floatW + 'px';
        p.el.style.height = floatH + 'px';
        p.el.style.flex = 'none';
        p.el.classList.add('floating');
        p.mode = 'floating';

        this.bringToFront(panelId);
        this.updateButtons(p);
        this.triggerResize();
    }

    toggleMaximize(panelId) {
        const p = this.panels.get(panelId);
        if (!p) return;

        if (p.mode === 'maximized') {
            this.restore(panelId);
            return;
        }

        if (p.mode === 'floating') {
            p.floatRect = {
                left: p.el.style.left,
                top: p.el.style.top,
                width: p.el.style.width,
                height: p.el.style.height
            };
        }

        if (p.mode === 'docked' && !p.placeholder) {
            const placeholder = document.createElement('div');
            placeholder.className = 'panel-placeholder';
            placeholder.dataset.panelId = panelId;
            if (p.el.id === 'control-panel') {
                placeholder.style.width = getComputedStyle(p.el).width;
            }
            p.el.parentNode.insertBefore(placeholder, p.el);
            p.placeholder = placeholder;
            document.body.appendChild(p.el);
        }

        p.el.style.position = 'fixed';
        p.el.style.left = '0';
        p.el.style.top = '0';
        p.el.style.width = '100vw';
        p.el.style.height = '100vh';
        p.el.style.flex = 'none';
        p.el.classList.remove('floating');
        p.el.classList.add('maximized');
        p.mode = 'maximized';

        this.bringToFront(panelId);
        this.updateButtons(p);
        this.triggerResize();
    }

    restore(panelId) {
        const p = this.panels.get(panelId);
        if (!p) return;

        p.el.classList.remove('floating', 'maximized');
        p.el.style.position = '';
        p.el.style.left = '';
        p.el.style.top = '';
        p.el.style.width = '';
        p.el.style.height = '';
        p.el.style.flex = '';
        p.el.style.zIndex = '';

        if (p.placeholder) {
            p.placeholder.parentNode.insertBefore(p.el, p.placeholder);
            p.placeholder.remove();
            p.placeholder = null;
        }

        p.mode = 'docked';
        p.floatRect = null;
        this.updateButtons(p);
        this.triggerResize();
    }

    bringToFront(panelId) {
        const p = this.panels.get(panelId);
        if (!p) return;
        this.topZ++;
        p.el.style.zIndex = this.topZ;
    }

    updateButtons(p) {
        if (p.mode === 'docked') {
            p.floatBtn.style.display = '';
            p.maxBtn.style.display = '';
            p.restoreBtn.style.display = 'none';
            p.resizeHandle.style.display = 'none';
            p.floatBtn.title = 'Undock Panel';
        } else if (p.mode === 'floating') {
            p.floatBtn.style.display = '';
            p.maxBtn.style.display = '';
            p.restoreBtn.style.display = '';
            p.resizeHandle.style.display = 'block';
            p.floatBtn.title = 'Dock Panel';
        } else if (p.mode === 'maximized') {
            p.floatBtn.style.display = 'none';
            p.maxBtn.style.display = 'none';
            p.restoreBtn.style.display = '';
            p.resizeHandle.style.display = 'none';
        }
    }

    handleMouseMove(e) {
        if (this.dragState) {
            const d = this.dragState;
            const p = this.panels.get(d.panelId);
            if (!p) return;
            const dx = e.clientX - d.startX;
            const dy = e.clientY - d.startY;
            p.el.style.left = (d.startLeft + dx) + 'px';
            p.el.style.top = (d.startTop + dy) + 'px';
        }

        if (this.resizeState) {
            const r = this.resizeState;
            const p = this.panels.get(r.panelId);
            if (!p) return;
            const dx = e.clientX - r.startX;
            const dy = e.clientY - r.startY;
            const newW = Math.max(300, r.startW + dx);
            const newH = Math.max(200, r.startH + dy);
            p.el.style.width = newW + 'px';
            p.el.style.height = newH + 'px';
            this.triggerResize();
        }
    }

    handleMouseUp() {
        if (this.dragState) {
            this.dragState = null;
        }
        if (this.resizeState) {
            this.resizeState = null;
            this.triggerResize();
        }
    }

    triggerResize() {
        if (this.onResize) {
            requestAnimationFrame(() => this.onResize());
        }
    }
}
