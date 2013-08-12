;(function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
// ### `editableCell` binding
//
// The `editableCell` binding turns regular table cells into selectable, editable Excel-like cells.
//
// #### Usage
//
// Bind a property to the table cell element:
//
//     <td data-bind="editableCell: name"></td>
//
// In addition, the following supporting bindings may be used for configuration:
//
// - `cellText` - Overrides the text displayed in the cell
// 
//          editableCell: amount, cellText: '$' + amount()
// 
// - `cellReadOnly` - Sets whether or not the cell can be edited
//
//          editableCell: amount, cellReadOnly: true
//
// Information on the currently cells in the table can be aquired using the
// [`editableCellSelection`](#editablecellselection) table binding.

// #### Documentation
ko.bindingHandlers.editableCell = {
    // Binding initialization makes sure the common selection is initialized, before initializing the cell in question
    // and registering it with the selection.
    //
    // Every instance of the `editableCell` binding share a per table [selection](#selection).
    // The first cell being initialized per table will do the one-time initialization of the common table selection.
    init: function (element, valueAccessor, allBindingsAccessor) {
        var table = $(element).parents('table')[0],
            selection = table._cellSelection;

        if (selection === undefined) {
            table._cellSelection = selection = new ko.bindingHandlers.editableCell.Selection(table);
        }

        selection.registerCell(element);

        element._cellValue = valueAccessor;
        element._cellText = function () { return allBindingsAccessor().cellText || this._cellValue(); };
        element._cellReadOnly = function () { return ko.utils.unwrapObservable(allBindingsAccessor().cellReadOnly); };
        element._cellValueUpdater = function (newValue) {
            ko.bindingHandlers.editableCell.updateBindingValue('editableCell', this._cellValue, allBindingsAccessor, newValue);

            if (!ko.isObservable(this._cellValue())) {
                this.textContent = ko.utils.unwrapObservable(this._cellText());
            }
        };

        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            selection.unregisterCell(element);

            element._cellValue = null;
            element._cellText = null;
            element._cellReadOnly = null;
            element._cellValueUpdater = null;
        });
    },
    // Binding update simply updates the text content of the table cell.
    update: function (element, valueAccessor, allBindingsAccessor) {
        element.textContent = ko.utils.unwrapObservable(element._cellText());
    },
    // `updateBindingValue` is a helper function borrowing private binding update functionality
    // from Knockout.js for supporting updating of both observables and non-observables.
    updateBindingValue: function (bindingName, valueAccessor, allBindingsAccessor, newValue) {
        if (ko.isWriteableObservable(valueAccessor())) {
            valueAccessor()(newValue);
            return;
        }

        var propertyWriters = allBindingsAccessor()._ko_property_writers;
        if (propertyWriters && propertyWriters[bindingName]) {
            propertyWriters[bindingName](newValue);
        }

        if (!ko.isObservable(valueAccessor())) {
            allBindingsAccessor()[bindingName] = newValue;
        }
    },
    // #### <a name="selection"></a> `Selection`
    //
    // The `Selection` is used internally to represent the selection for a single table, 
    // comprising a [view](#view) and a [range](#range), as well as functionality for handling table cell
    // operations like selecting, editing and copy and paste.
    Selection: function (table) {
        var self = this,
            selectionSubscription;

        self.view = new ko.bindingHandlers.editableCell.SelectionView(table, self);
        self.range = new ko.bindingHandlers.editableCell.SelectionRange(cellIsSelectable);

        selectionSubscription = self.range.selection.subscribe(function (newSelection) {
            if (newSelection.length === 0) {
                self.view.hide();
                return;
            }
            self.view.update(newSelection[0], newSelection[newSelection.length - 1]);
        });

        ko.utils.domNodeDisposal.addDisposeCallback(table, function () {
            selectionSubscription.dispose();

            self.view.destroy();
            self.range.clear();

            table._cellSelection = null;
        });

        self.focus = self.view.focus;

        self.registerCell = function (cell) {
            ko.utils.registerEventHandler(cell, "mousedown", self.onMouseDown);
            ko.utils.registerEventHandler(cell, "mouseup", self.onMouseUp);
            ko.utils.registerEventHandler(cell, "mouseover", self.onCellMouseOver);
            ko.utils.registerEventHandler(cell, "focus", self.onCellFocus);
            ko.utils.registerEventHandler(cell, "blur", self.onCellBlur);
            ko.utils.registerEventHandler(cell, "keydown", self.onCellKeyDown);
        };

        self.unregisterCell = function (cell) {
            cell.removeEventListener('mousedown', self.onMouseDown);
            cell.removeEventListener('mouseup', self.onMouseUp);
            cell.removeEventListener('mouseover', self.onCellMouseOver);
            cell.removeEventListener('focus', self.onCellFocus);
            cell.removeEventListener('blur', self.onCellBlur);
            cell.removeEventListener('keydown', self.onCellKeyDown);
        };

        self.onMouseDown = function (event) {
            if (self.isEditingCell(this)) {
                return;
            }

            self.onCellMouseDown(this, event.shiftKey);
            event.preventDefault();
        };

        self.onMouseUp = function (event) {
            if (self.isEditingCell(this)) {
                event.stopPropagation();
                return;
            }
        };

        self.updateCellValue = function (cell, newValue) {
            var value;

            if (!cellIsEditable(cell)) {
                return undefined;
            }

            if (newValue === undefined) {
                value = cell.textContent;
                self.restoreCellText(cell);
            }
            else {
                value = newValue;
            }

            cell._cellValueUpdater(value);

            return value;
        };
        self.restoreCellText = function (cell) {
            cell.textContent = cell._oldTextContent;
        };

        self.startEditing = function () {
            self.startEditingCell(self.range.start);
        };
        self.startEditingCell = function (cell) {
            if (!cellIsEditable(cell)) {
                return;
            }

            if (self.range.start !== cell) {
                self.range.setStart(cell);
            }

            cell._oldTextContent = cell.textContent;
            cell.textContent = ko.utils.unwrapObservable(cell._cellValue());

            cell.contentEditable = true;
            cell.focus();
            document.execCommand('selectAll', false, null);
            self.view.element.style.pointerEvents = 'none';
        };
        self.isEditingCell = function (cell) {
            return cell.contentEditable === 'true';
        };
        self.cancelEditingCell = function (cell) {
            cell.contentEditable = false;
            self.restoreCellText(cell);
            self.view.element.style.pointerEvents = 'inherit';
        };
        self.endEditingCell = function (cell) {
            cell.contentEditable = false;
            self.view.element.style.pointerEvents = 'inherit';
            return self.updateCellValue(cell);
        };
        function cellIsSelectable(cell) {
            return cell._cellValue !== undefined;
        }
        function cellIsEditable(cell) {
            return cell._cellReadOnly() !== true;
        }
        self.onCellMouseDown = function (cell, shiftKey) {
            if (shiftKey) {
                self.range.setEnd(cell);
            }
            else {
                self.range.setStart(cell);
            }

            self.view.beginDrag();
            event.preventDefault();
        };
        self.onCellMouseOver = function (event) {
            if (self.view.isDragging && event.target !== self.range.end) {
                self.range.setEnd(event.target);
            }
        };
        self.onCellKeyDown = function (event) {
            var cell = event.target;

            if (event.keyCode === 13) { // Return
                if (!self.isEditingCell(cell)) {
                    return;
                }

                var value = self.endEditingCell(event.target);

                if (event.ctrlKey) {
                    ko.utils.arrayForEach(self.range.getCells(), function (cell) {
                        self.updateCellValue(cell, value);
                    });
                }

                self.onReturn(event, event.ctrlKey);
                self.focus();
                event.preventDefault();
            }
            else if ([37, 38, 39, 40].indexOf(event.keyCode) !== -1) { // Arrows
                self.focus();
                self.onArrows(event);
                event.preventDefault();
            }
            else if (event.keyCode === 27) { // Escape
                if (!self.isEditingCell(cell)) {
                    return;
                }

                self.cancelEditingCell(event.target);
                self.focus();
            }
        };
        self.onCellFocus = function (event) {
            if (event.target === self.range.start) {
                return;
            }

            setTimeout(function () {
                self.range.setStart(event.target);
            }, 0);
        };
        self.onCellBlur = function (event) {
            if (!self.isEditingCell(event.target)) {
                return;
            }

            self.endEditingCell(event.target);
        };
        self.onReturn = function (event, preventMove) {
            if (preventMove !== true) {
                self.range.moveInDirection('Down');
            }
            event.preventDefault();
        };
        self.onArrows = function (event) {
            var preventDefault;

            if (event.shiftKey && !event.ctrlKey) {
                preventDefault = self.range.extendInDirection(self.keyCodeIdentifier[event.keyCode]);
            }
            else if (!event.ctrlKey) {
                preventDefault = self.range.moveInDirection(self.keyCodeIdentifier[event.keyCode]);
            }

            if (preventDefault) {
                event.preventDefault();
            }
        };
        self.onCopy = function () {
            var cells = self.range.getCells(),
                cols = cells[cells.length - 1].cellIndex - cells[0].cellIndex + 1,
                rows = cells.length / cols,
                lines = [],
                i = 0;

            ko.utils.arrayForEach(cells, function (cell) {
                var lineIndex = i % rows,
                    rowIndex = Math.floor(i / rows);

                lines[lineIndex] = lines[lineIndex] || [];
                lines[lineIndex][rowIndex] = ko.utils.unwrapObservable(cell._cellValue());

                i++;
            });

            return ko.utils.arrayMap(lines, function (line) {
                return line.join('\t');
            }).join('\r\n');
        };
        self.onPaste = function (text) {
            var selStart = self.range.getCells()[0],
                cells,
                values = ko.utils.arrayMap(text.trim().split(/\r?\n/), function (line) { return line.split('\t'); }),
                row = values.length,
                col = values[0].length,
                rows = 1,
                cols = 1,
                i = 0;

            self.range.setStart(selStart);

            while (row-- > 1 && self.range.extendInDirection('Down')) { rows++ };
            while (col-- > 1 && self.range.extendInDirection('Right')) { cols++ };

            cells = self.range.getCells();

            for (col = 0; col < cols; col++) {
                for (row = 0; row < rows; row++) {
                    self.updateCellValue(cells[i], values[row][col]);
                    i++;
                }
            }
        };
        self.onTab = function (event) {
            self.range.start.focus();
        };
        self.keyCodeIdentifier = {
            37: 'Left',
            38: 'Up',
            39: 'Right',
            40: 'Down'
        };
    },
    // #### <a name="view"></a> `SelectionView`
    //
    // The `SelectionView` is used internally to represent the selection view, that is the
    // visual selection of either one or more cells.
    SelectionView: function (table, selection) {
        var self = this,
            html = document.getElementsByTagName('html')[0];

        self.element = document.createElement('div');
        self.element.style.position = 'absolute';
        self.element.style.display = 'none';
        self.element.tabIndex = -1;

        self.copyPasteElement = document.createElement('textarea');
        self.copyPasteElement.style.position = 'absolute';
        self.copyPasteElement.style.opacity = '0.0';
        self.copyPasteElement.style.display = 'none';

        table.appendChild(self.element);
        table.appendChild(self.copyPasteElement);

        self.destroy = function () {
            self.element.removeEventListener('mousedown', self.onMouseDown);
            self.element.removeEventListener('dblclick', self.onDblClick);
            self.element.removeEventListener('keypress', self.onKeyPress);
            self.element.removeEventListener('keydown', self.onKeyDown);

            $(html).unbind('mouseup', self.onMouseUp);

            table.removeChild(self.element);
            table.removeChild(self.copyPasteElement);
        };
        self.show = function () {
            self.element.style.display = 'block';
            self.element.focus();
            self.element.scrollIntoViewIfNeeded();
        };
        self.hide = function () {
            self.element.style.display = 'none';
        };
        self.focus = function () {
            self.element.focus();
        };
        self.update = function (start, end) {
            var top = Math.min(start.offsetTop, end.offsetTop),
                left = Math.min(start.offsetLeft, end.offsetLeft),
                bottom = Math.max(start.offsetTop + start.offsetHeight,
                                end.offsetTop + end.offsetHeight),
                right = Math.max(start.offsetLeft + start.offsetWidth,
                                end.offsetLeft + end.offsetWidth);

            self.element.style.top = top + 1 + 'px';
            self.element.style.left = left + 1 + 'px';
            self.element.style.height = bottom - top - 1 + 'px';
            self.element.style.width = right - left - 1 + 'px';
            self.element.style.backgroundColor = 'rgba(245, 142, 00, 0.15)';

            self.show();
        };
        self.beginDrag = function () {
            self.canDrag = true;
            ko.utils.registerEventHandler(self.element, 'mousemove', self.doBeginDrag);
        };
        self.doBeginDrag = function () {
            self.element.removeEventListener('mousemove', self.doBeginDrag);

            if (!self.canDrag) {
                return;
            }

            self.isDragging = true;
            self.element.style.pointerEvents = 'none';
        };
        self.endDrag = function () {
            self.element.removeEventListener('mousemove', self.doBeginDrag);
            self.isDragging = false;
            self.canDrag = false;
            self.element.style.pointerEvents = 'inherit';
        };

        self.onMouseUp = function (event) {
            self.endDrag();
        };
        self.onMouseDown = function (event) {
            if (event.button !== 0) {
                return;
            }

            self.hide();

            var cell = event.view.document.elementFromPoint(event.clientX, event.clientY);
            selection.onCellMouseDown(cell, event.shiftKey);

            event.preventDefault();
        };
        self.onDblClick = function (event) {
            selection.startEditing();
        };
        self.onKeyPress = function (event) {
            selection.startEditing();
        };
        self.onKeyDown = function (event) {
            if (event.keyCode === 13) {
                selection.onReturn(event);
            } else if ([37, 38, 39, 40].indexOf(event.keyCode) !== -1) {
                selection.onArrows(event);
            } else if (event.keyCode === 86 && event.ctrlKey) {
                self.copyPasteElement.value = '';
                self.copyPasteElement.style.display = 'block';
                self.copyPasteElement.focus();
                setTimeout(function () {
                    selection.onPaste(self.copyPasteElement.value);
                    self.copyPasteElement.style.display = 'none';
                    self.focus();
                }, 0);
            } else if (event.keyCode === 67 && event.ctrlKey) {
                self.copyPasteElement.value = selection.onCopy();
                self.copyPasteElement.style.display = 'block';
                self.copyPasteElement.focus();
                document.execCommand('selectAll', false, null);
                setTimeout(function () {
                    self.copyPasteElement.style.display = 'none';
                    self.focus();
                }, 0);
            } else if (event.keyCode === 9) {
                selection.onTab(event);
            }
        };

        ko.utils.registerEventHandler(self.element, "mousedown", self.onMouseDown);
        ko.utils.registerEventHandler(self.element, "dblclick", self.onDblClick);
        ko.utils.registerEventHandler(self.element, "keypress", self.onKeyPress);
        ko.utils.registerEventHandler(self.element, "keydown", self.onKeyDown);

        ko.utils.registerEventHandler(html, "mouseup", self.onMouseUp);
    },
    // #### <a name="range"></a> `SelectionRange`
    //
    // The `SelectionRange` is used internally to hold the current selection, represented by a start and an end cell.
    // In addition, it has functionality for moving and extending the selection inside the table.
    SelectionRange: function (cellIsSelectable) {
        var self = this;

        self.start = undefined;
        self.end = undefined;
        self.selection = ko.observableArray();

        // `moveInDirection` drops the current selection and makes the single cell in the specified `direction` the new selection.
        self.moveInDirection = function (direction) {
            var newStart = self.getSelectableCellInDirection(self.start, direction),
                startChanged = newStart !== self.start;

            if (newStart !== self.start || self.start !== self.end) {
                self.setStart(newStart);
            }

            return startChanged;
        };

        // `extendIndirection` keeps the current selection and extends it in the specified `direction`.
        self.extendInDirection = function (direction) {
            var newEnd = self.getCellInDirection(self.end, direction),
                endChanged = newEnd !== self.end;

            self.setEnd(newEnd);

            return endChanged;
        };

        // `getCells` returnes the cells contained in the current selection.
        self.getCells = function () {
            return self.getCellsInArea(self.start, self.end);
        };

        // `clear` clears the current selection.
        self.clear = function () {
            self.start = undefined;
            self.end = undefined;
            self.selection([]);
        };

        self.setStart = function (element) {
            self.start = element;
            self.end = element;
            self.selection(self.getCells());
        };
        self.setEnd = function (element) {
            if (element === self.end) {
                return;
            }
            self.start = self.start || element;

            var cellsInArea = self.getCellsInArea(self.start, element),
                allEditable = true;

            ko.utils.arrayForEach(cellsInArea, function (cell) {
                allEditable = allEditable && cellIsSelectable(cell);
            });

            if (!allEditable) {
                return;
            }

            self.end = element;
            self.selection(self.getCells());
        };
        self.getCellInDirection = function (originCell, direction, rowIndex, cellIndex) {
            var originRow = originCell.parentNode,
                cell;

            rowIndex = typeof rowIndex !== 'undefined' ? rowIndex : originRow.rowIndex - self.getRowsOffset(originCell),
            cellIndex = typeof cellIndex !== 'undefined' ? cellIndex : originCell.cellIndex;

            if (direction === 'Left' && cellIndex > 0) {
                return originRow.children[cellIndex - 1];
            }
            if (direction === 'Up' && rowIndex > 0) {
                cell = originRow.parentNode.children[rowIndex - 1].children[cellIndex];
                return cell || self.getCellInDirection(originCell, direction, rowIndex - 1, cellIndex);
            }
            if (direction === 'Right' && cellIndex < originCell.parentNode.children.length - 1) {
                return originRow.children[cellIndex + 1];
            }
            if (direction === 'Down' && rowIndex < originCell.parentNode.parentNode.children.length - 1) {
                cell = originRow.parentNode.children[rowIndex + 1].children[cellIndex];
                return cell || self.getCellInDirection(originCell, direction, rowIndex + 1, cellIndex);
            }

            return originCell;
        };
        self.getSelectableCellInDirection = function (originCell, direction) {
            var lastCell,
                cell = originCell;

            while (cell !== lastCell) {
                lastCell = cell;
                cell = self.getCellInDirection(cell, direction);

                if (cellIsSelectable(cell)) {
                    return cell;
                }
            }

            return originCell;
        };
        self.getCellsInArea = function (startCell, endCell) {
            var startX = Math.min(startCell.cellIndex, endCell.cellIndex),
                startY = Math.min(startCell.parentNode.rowIndex, endCell.parentNode.rowIndex),
                endX = Math.max(startCell.cellIndex, endCell.cellIndex),
                endY = Math.max(startCell.parentNode.rowIndex, endCell.parentNode.rowIndex),
                x, y,
                rowsOffset = self.getRowsOffset(startCell),
                cell,
                cells = [];

            for (x = startX; x <= endX; ++x) {
                for (y = startY; y <= endY; ++y) {
                    cell = startCell.parentNode.parentNode.children[y - rowsOffset].children[x];
                    cells.push(cell || {});
                }
            }

            return cells;
        };
        self.getRowsOffset = function (cell) {
            var rows = cell.parentNode.parentNode.children;

            return rows[rows.length - 1].rowIndex + 1 - rows.length;
        };
    }
};

// ### <a name="editablecellselection"></a> `editableCellSelection` binding
//
// The `editableCellSelection` binding is a one-way binding that will reflect the currently selected cells in a table.
//
// #### Usage
//
// 1) Add a `selection` observable array to your view model:
// 
//     viewModel.selection = ko.observableArray();
//
// 2) Bind the property to the table element using the `editableCellSelection` binding:
//
//     <table data-bind="editableCellSelection: selection" .. >
//
// Each element in the observable array will have the following properties:
//
// - `cell` - The table cell itself
// - `value` - The value of the `editableCell` binding
// - `text` - The value of the `cellText` binding, or same as `value`
//
// Using utility functions like `ko.dataFor` on the `cell` property, you can get hold of the row view model.

ko.bindingHandlers.editableCellSelection = {
    init: function (element) {
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            element._cellSelectionSubscription.dispose();
            element._cellSelectionSubscription = null;
        });
    },
    update: function (element, valueAccessor, allBindingsAccessor) {
        var table = element,
            selection = table._cellSelection;

        if (element.tagName !== 'TABLE') {
            throw new Error('editableCellSelection binding can only be applied to tables');
        }

        if (selection === undefined) {
            table._cellSelection = selection = new ko.bindingHandlers.editableCell.Selection(table);
        }

        if (table._cellSelectionSubscription) {
            table._cellSelectionSubscription.dispose();
        }

        table._cellSelectionSubscription = selection.range.selection.subscribe(function (newSelection) {
            newSelection = ko.utils.arrayMap(newSelection, function (cell) {
                return {
                    cell: cell,
                    value: cell._cellValue(),
                    text: cell._cellText()
                };
            });

            ko.bindingHandlers.editableCell.updateBindingValue('editableCellSelection', valueAccessor, allBindingsAccessor, newSelection);
        });
    }
};
},{}]},{},[1])
;