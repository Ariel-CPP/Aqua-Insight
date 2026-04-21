const ZoomPan = (() => {
  const viewportState = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
  };

  function resetViewport() {
    viewportState.scale = 1;
    viewportState.offsetX = 0;
    viewportState.offsetY = 0;
  }

  function fitViewportToCanvas(canvas, imageWidth, imageHeight) {
    const scaleX = canvas.width / imageWidth;
    const scaleY = canvas.height / imageHeight;

    viewportState.scale = Math.min(scaleX, scaleY);
    viewportState.offsetX = 0;
    viewportState.offsetY = 0;
  }

  function applyViewportTransform(context) {
    context.setTransform(
      viewportState.scale,
      0,
      0,
      viewportState.scale,
      viewportState.offsetX,
      viewportState.offsetY
    );
  }

  function getViewportState() {
    return { ...viewportState };
  }

  function setViewportState(newState = {}) {
    viewportState.scale = newState.scale ?? viewportState.scale;
    viewportState.offsetX = newState.offsetX ?? viewportState.offsetX;
    viewportState.offsetY = newState.offsetY ?? viewportState.offsetY;
  }

  function handleWheelZoom(event, canvasList = []) {
    event.preventDefault();

    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;

    viewportState.scale *= zoomFactor;
    viewportState.scale = Utils.clamp(viewportState.scale, 0.2, 10);

    canvasList.forEach(canvas => {
      redrawCanvas(canvas);
    });
  }

  function startPan(event) {
    viewportState.isDragging = true;
    viewportState.dragStartX = event.clientX - viewportState.offsetX;
    viewportState.dragStartY = event.clientY - viewportState.offsetY;
  }

  function movePan(event, canvasList = []) {
    if (!viewportState.isDragging) {
      return;
    }

    viewportState.offsetX = event.clientX - viewportState.dragStartX;
    viewportState.offsetY = event.clientY - viewportState.dragStartY;

    canvasList.forEach(canvas => {
      redrawCanvas(canvas);
    });
  }

  function endPan() {
    viewportState.isDragging = false;
  }

  function redrawCanvas(canvas) {
    const redrawHandler = canvas.redrawHandler;

    if (typeof redrawHandler === 'function') {
      redrawHandler();
    }
  }

  function bindCanvasInteractions(canvas, canvasList = []) {
    canvas.addEventListener('wheel', event => {
      handleWheelZoom(event, canvasList);
    });

    canvas.addEventListener('mousedown', event => {
      startPan(event);
    });

    window.addEventListener('mousemove', event => {
      movePan(event, canvasList);
    });

    window.addEventListener('mouseup', () => {
      endPan();
    });
  }

    function getCanvasCoordinates(event, canvas) {
    const rect = canvas.getBoundingClientRect();

    const x =
      (event.clientX - rect.left - viewportState.offsetX) /
      viewportState.scale;

    const y =
      (event.clientY - rect.top - viewportState.offsetY) /
      viewportState.scale;

    return {
      x: Utils.roundTo(x, 2),
      y: Utils.roundTo(y, 2)
    };
  }

  function syncCrosshairPosition(event, wrapperIds = []) {
    wrapperIds.forEach(wrapperId => {
      const wrapper = document.getElementById(wrapperId);

      if (!wrapper) return;

      let crosshair = wrapper.querySelector('.canvas-crosshair');

      if (!crosshair) {
        crosshair = document.createElement('div');
        crosshair.className = 'canvas-crosshair';
        wrapper.appendChild(crosshair);
      }

      const rect = wrapper.getBoundingClientRect();

      const relativeX = event.clientX - rect.left;
      const relativeY = event.clientY - rect.top;

      crosshair.style.setProperty('--crosshair-x', `${relativeX}px`);
      crosshair.style.setProperty('--crosshair-y', `${relativeY}px`);
    });
  }

  function removeCrosshair(wrapperIds = []) {
    wrapperIds.forEach(wrapperId => {
      const wrapper = document.getElementById(wrapperId);

      if (!wrapper) return;

      const crosshair = wrapper.querySelector('.canvas-crosshair');

      if (crosshair) {
        crosshair.remove();
      }
    });
  }

  function bindCrosshairSync(canvas, wrapperIds = []) {
    canvas.addEventListener('mousemove', event => {
      syncCrosshairPosition(event, wrapperIds);
    });

    canvas.addEventListener('mouseleave', () => {
      removeCrosshair(wrapperIds);
    });
  }

  function registerRedrawHandler(canvas, handler) {
    canvas.redrawHandler = handler;
  }

  function zoomIn(canvasList = []) {
    viewportState.scale *= 1.1;
    viewportState.scale = Utils.clamp(viewportState.scale, 0.2, 10);

    canvasList.forEach(canvas => redrawCanvas(canvas));
  }

  function zoomOut(canvasList = []) {
    viewportState.scale *= 0.9;
    viewportState.scale = Utils.clamp(viewportState.scale, 0.2, 10);

    canvasList.forEach(canvas => redrawCanvas(canvas));
  }

  return {
    resetViewport,
    fitViewportToCanvas,
    applyViewportTransform,
    getViewportState,
    setViewportState,
    handleWheelZoom,
    startPan,
    movePan,
    endPan,
    redrawCanvas,
    bindCanvasInteractions,
    getCanvasCoordinates,
    syncCrosshairPosition,
    removeCrosshair,
    bindCrosshairSync,
    registerRedrawHandler,
    zoomIn,
    zoomOut
  };
})();
