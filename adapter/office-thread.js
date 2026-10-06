/* Adapted from allotropia/zetajs web-office, SPDX-License-Identifier: MIT.
 * See LICENSE.zetajs. The original selected model remains the export target. */
'use strict';
Module.zetajs.then(function(zetajs) {
  var css = zetajs.uno.com.sun.star;
  var desktop = css.frame.Desktop.create(zetajs.getUnoComponentContext());
  var model = null;
  var selectedFilename = null;
  var selectedFilter = null;
  var modifyListener = null;
  var selectedController = null;
  var viewSettings = null;
  var format = null;
  var viewObserver = null;
  var observedZoom = null;
  var pendingFit = null;
  function selectedView() {
    return model && viewSettings && zetajs.sameUnoObject(model.getCurrentController(), selectedController);
  }
  function observePresentationZoom() {
    try {
      if (!selectedView()) throw new Error('view_unavailable');
      var actual = zoomValue();
      // Impress queues PAGE_WIDTH/WHOLEPAGE after the property setter returns.
      // Read the native active-window zoom instead of acknowledging that stale
      // snapshot. Keep observing after acknowledgement for later layout changes.
      if (pendingFit && (actual !== pendingFit.before || Date.now() >= pendingFit.deadline)) {
        var requestId = pendingFit.requestId;
        pendingFit = null;
        observedZoom = actual;
        zetajs.mainPort.postMessage({ cmd: 'view_result', requestId: requestId, ok: true, zoom: actual });
      } else if (!pendingFit && actual !== observedZoom) {
        observedZoom = actual;
        zetajs.mainPort.postMessage({ cmd: 'view_ready', format: format, zoom: actual });
      }
    } catch {
      clearInterval(viewObserver);
      viewObserver = null;
      viewSettings = null;
      if (pendingFit) {
        zetajs.mainPort.postMessage({ cmd: 'view_result', requestId: pendingFit.requestId, ok: false });
        pendingFit = null;
      }
    }
  }
  function zoomValue() {
    var value = viewSettings.getPropertyValue('ZoomValue');
    if (!Number.isInteger(value) || value < 1 || value > 400) throw new Error('view_unavailable');
    return value;
  }
  function prepareView() {
    try {
      // Writer supplies a separate ViewSettings property set. Calc and
      // Impress expose the documented view properties on their controller.
      var settings = format === 'docx' ? selectedController.getViewSettings() : selectedController;
      var info = settings.getPropertySetInfo();
      if (!info.hasPropertyByName('ZoomType') || !info.hasPropertyByName('ZoomValue')) return;
      viewSettings = settings;
      observedZoom = zoomValue();
      zetajs.mainPort.postMessage({ cmd: 'view_ready', format: format, zoom: observedZoom });
      if (format === 'pptx') viewObserver = setInterval(observePresentationZoom, 250);
    } catch { viewSettings = null; }
  }
  zetajs.mainPort.onmessage = function(event) {
    var data = event.data;
    try {
      if (data.cmd === 'open' && !model && /^selected\.(docx|xlsx|pptx)$/i.test(data.filename)) {
        model = desktop.loadComponentFromURL('file:///tmp/arvo-office/' + data.filename, '_default', 0, [
          // LibreOffice MacroExecMode.NEVER_EXECUTE = 0 (4 allows all macros).
          new css.beans.PropertyValue({ Name: 'MacroExecutionMode', Value: 0 }),
          new css.beans.PropertyValue({ Name: 'UpdateDocMode', Value: 0 }),
        ]);
        if (!model) throw new Error('document_unavailable');
        selectedFilename = data.filename;
        format = data.filename.split('.').pop().toLowerCase();
        selectedController = model.getCurrentController();
        var filter = model.getArgs().find(function(value) { return value.Name === 'FilterName'; });
        if (filter && typeof filter.Value === 'string' && filter.Value.length > 0) selectedFilter = filter.Value;
        if (!selectedFilter) throw new Error('selected_export_unavailable');
        // Modification broadcasts also cover state/view changes. Consult
        // the model flag at the event, rather than polling later or treating
        // a clean layout/native-save event as an edit. The parent latches a
        // real edit until the guarded Microsoft save is confirmed.
        modifyListener = zetajs.unoObject([css.util.XModifyListener], {
          modified: function() {
            if (model.isModified()) zetajs.mainPort.postMessage({ cmd: 'modified', modified: true });
          },
          disposing: function() { /* The selected model cannot be replaced. */ },
        });
        model.addModifyListener(modifyListener);
        selectedController.getFrame().getContainerWindow().FullScreen = true;
        zetajs.mainPort.postMessage({ cmd: 'loaded' });
        prepareView();
      }
      if (data.cmd === 'view' && typeof data.requestId === 'string' && data.requestId.length > 0 &&
          data.requestId.length <= 128 && (data.mode === 'fit' || (data.mode === 'zoom' &&
          Number.isInteger(data.zoom) && data.zoom >= 20 && data.zoom <= 200))) {
        try {
          if (!selectedView() || pendingFit)
            throw new Error('view_unavailable');
          // DocumentZoomType: PAGE_WIDTH=1, ENTIRE_PAGE=2, BY_VALUE=3.
          // These are controller properties, never model content, dispatches,
          // filesystem exports, or a reset of the model's modification flag.
          var before = zoomValue();
          viewSettings.setPropertyValue('ZoomType', new zetajs.Any(zetajs.type.short,
            data.mode === 'zoom' ? 3 : format === 'pptx' ? 2 : 1));
          if (data.mode === 'zoom')
            viewSettings.setPropertyValue('ZoomValue', new zetajs.Any(zetajs.type.short, data.zoom));
          if (format === 'pptx' && data.mode === 'fit') {
            // Bound an already-fitted/no-change request below the parent timeout.
            // This acknowledges only the current readback; subsequent native
            // changes remain observable and are never treated as content edits.
            pendingFit = { requestId: data.requestId, before: before, deadline: Date.now() + 3500 };
          } else {
            observedZoom = zoomValue();
            zetajs.mainPort.postMessage({ cmd: 'view_result', requestId: data.requestId, ok: true, zoom: observedZoom });
          }
        } catch { zetajs.mainPort.postMessage({ cmd: 'view_result', requestId: data.requestId, ok: false }); }
      }
      if (data.cmd === 'export' && model) {
        if (pendingFit) throw new Error('view_pending');
        // Save As may change the model location/filter. Export a copy using
        // the captured input filter and fixed original path instead.
        if (!selectedFilename || !selectedFilter) throw new Error('selected_export_unavailable');
        model.storeToURL('file:///tmp/arvo-office/' + selectedFilename, [
          new css.beans.PropertyValue({ Name: 'FilterName', Value: selectedFilter }),
          new css.beans.PropertyValue({ Name: 'Overwrite', Value: true }),
        ]);
        zetajs.mainPort.postMessage({ cmd: 'exported', requestId: data.requestId });
      }
      // FullScreen can capture the engine's startup dimensions before the
      // browser resize callback settles. Apply the actual isolated canvas
      // bounds explicitly; this changes only the window, never the model.
      if (data.cmd === 'resize' && model && Number.isInteger(data.width) && Number.isInteger(data.height) &&
          data.width > 0 && data.height > 0 && data.width <= 8192 && data.height <= 8192 &&
          data.width * data.height <= 16777216) {
        selectedController.getFrame().getContainerWindow().setPosSize(0, 0, data.width, data.height, 15);
      }
    } catch { zetajs.mainPort.postMessage({ cmd: 'error' }); }
  };
  zetajs.mainPort.postMessage({ cmd: 'engine_ready' });
});
