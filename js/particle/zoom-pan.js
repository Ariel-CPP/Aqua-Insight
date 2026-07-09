/* ==========================================================================
   AQUA INSIGHT - CANVAS ZOOM & PAN INTERACTIVE LOGIC
   Manages pan offsets, zoom scaling centered on cursor, and bounds mapping.
   ========================================================================== */

window.AquaZoomPan = class {
  constructor(canvasId, redrawCallback) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.redraw = redrawCallback;
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    
    // Zoom constraints
    this.minScale = 0.1;
    this.maxScale = 20.0;
    
    this.initEvents();
  }
  
  reset() {
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.updateHUD();
    this.redraw();
  }
  
  initEvents() {
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;
    
    // Mouse Down - Start dragging
    wrapper.addEventListener("mousedown", (e) => {
      // Only drag if left click
      if (e.button !== 0) return;
      this.isDragging = true;
      this.startX = e.clientX - this.offsetX;
      this.startY = e.clientY - this.offsetY;
      wrapper.style.cursor = "grabbing";
    });
    
    // Mouse Move - Dragging in progress
    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      this.offsetX = e.clientX - this.startX;
      this.offsetY = e.clientY - this.startY;
      this.redraw();
    });
    
    // Mouse Up - End dragging
    window.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        wrapper.style.cursor = "grab";
      }
    });
    
    // Mouse Wheel - Zoom centered at cursor position
    wrapper.addEventListener("wheel", (e) => {
      e.preventDefault();
      
      const zoomIntensity = 0.1;
      const rect = this.canvas.getBoundingClientRect();
      
      // Calculate mouse pointer relative to canvas coordinates
      const mouseX = e.clientX - rect.left - this.offsetX;
      const mouseY = e.clientY - rect.top - this.offsetY;
      
      // Calculate coordinates before zoom scale
      const zoomX = mouseX / this.scale;
      const zoomY = mouseY / this.scale;
      
      // Update scale
      const zoomFactor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
      let newScale = this.scale * zoomFactor;
      newScale = Math.min(Math.max(newScale, this.minScale), this.maxScale);
      
      // Adjust offsets so zoom centers on cursor
      this.offsetX = e.clientX - rect.left - zoomX * newScale;
      this.offsetY = e.clientY - rect.top - zoomY * newScale;
      this.scale = newScale;
      
      this.updateHUD();
      this.redraw();
    }, { passive: false });
  }
  
  // Apply translation and scaling to canvas 2D context
  applyTransform(ctx) {
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
  }
  
  // Map screen coordinates (click coords) back to original source image pixel coordinates
  screenToCanvasCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.offsetX) / this.scale;
    const y = (clientY - rect.top - this.offsetY) / this.scale;
    return { x, y };
  }
  
  updateHUD() {
    const zoomText = document.getElementById("hud-zoom");
    if (zoomText) {
      zoomText.textContent = `Zoom: ${Math.round(this.scale * 100)}%`;
    }
  }
};
