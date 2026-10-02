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
  zetajs.mainPort.onmessage = function(event) {
    var data = event.data;
    try {
      if (data.cmd === 'open' && !model && /^selected\.(docx|xlsx|pptx)$/.test(data.filename)) {
        model = desktop.loadComponentFromURL('file:///tmp/arvo-office/' + data.filename, '_default', 0, [
          // LibreOffice MacroExecMode.NEVER_EXECUTE = 0 (4 allows all macros).
          new css.beans.PropertyValue({ Name: 'MacroExecutionMode', Value: 0 }),
          new css.beans.PropertyValue({ Name: 'UpdateDocMode', Value: 0 }),
        ]);
        if (!model) throw new Error('document_unavailable');
        selectedFilename = data.filename;
        var filter = model.getArgs().find(function(value) { return value.Name === 'FilterName'; });
        if (filter && typeof filter.Value === 'string' && filter.Value.length > 0) selectedFilter = filter.Value;
        if (!selectedFilter) throw new Error('selected_export_unavailable');
        // Polling can miss edit + native Save between polls. Every model
        // change latches provider-unsaved state, even if the engine then
        // writes its private filesystem and clears isModified().
        modifyListener = zetajs.unoObject([css.util.XModifyListener], {
          modified: function() { zetajs.mainPort.postMessage({ cmd: 'modified', modified: true }); },
          disposing: function() { /* The selected model cannot be replaced. */ },
        });
        model.addModifyListener(modifyListener);
        model.getCurrentController().getFrame().getContainerWindow().FullScreen = true;
        zetajs.mainPort.postMessage({ cmd: 'loaded' });
      }
      if (data.cmd === 'export' && model) {
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
        model.getCurrentController().getFrame().getContainerWindow().setPosSize(0, 0, data.width, data.height, 15);
      }
    } catch { zetajs.mainPort.postMessage({ cmd: 'error' }); }
  };
  zetajs.mainPort.postMessage({ cmd: 'engine_ready' });
});
