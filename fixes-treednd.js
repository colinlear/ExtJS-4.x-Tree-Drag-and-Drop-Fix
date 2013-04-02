/*
Parts of this file are derived from Ext JS 4.2-gpl and as such Sencha Inc (probably)
retains all rights to those sections. Refer to the original code if unsure.

Copyright (c) 2013 Colin Lear
Copyright (c) 2011-2013 Sencha Inc

Original code maybe used as you see fit. Commercial licensees of ExtJS 4.x may use this
code without additional restrictions. Otherwise code is available as GPL 3.0

Derived from src/tree/ViewDropZone.js

Copyright (c) 2011-2013 Sencha Inc

Contact:  http://www.sencha.com/contact

GNU General Public License Usage
This file may be used under the terms of the GNU General Public License version 3.0 as
published by the Free Software Foundation.

Please review the following information to ensure the GNU General Public License version 3.0
requirements will be met: http://www.gnu.org/copyleft/gpl.html.

If you are unsure which license is appropriate for your use, please contact the sales department
at http://www.sencha.com/contact.

*//*

Version 1.0

Fixes:

- Ignore allowParentInserts (not necessary, and current usage is useless and broken)
- allowContainerDrops implemented, and enabled by default (most sensible choice)
- Ignore nested selections (nodes where an ancestor is also selected)
- option collapseExpandedNodes (default true) if nodes are expanded by hovering
		collapse if leave tree, false to keep expanded.

*/
Ext.define('fixes.TreeDnD', {}, function() {
	Ext.override(Ext.tree.ViewDropZone, {

		// duplicate selection handling, 'unique' || 'recursive'
		nestedNodeSelection: 'unique',

		collapseExpandedNodes: true,
		expanded: [],

		// add in callbacks to update position...
		expandNode : function(node, cb) {
			var view = this.view;
			this.expandProcId = false;
			if (!node.isLeaf() && !node.isExpanded() && !node.isExpandingOrCollapsing) {
				view.expand(node, cb?cb.call(this,node):Ext.EmptyFn);
				if (this.collapseExpandedNodes) {
					Ext.Array.include(this.expanded, node);
				}
				this.expandProcId = false;
			}
		},

		queueExpand : function(node,cb) {
			this.expandProcId = Ext.Function.defer(this.expandNode, this.expandDelay, this, [node,cb]);
		},

		// Support position 'insert' when trying an after type insert on an expanded node.
		// Similar to allowParentInserts except that it doesn't put insertion as the next 
		// sibling of the folder, which is just dumb. Instead it makes the inserted node
		// the first child of the target...
		getPosition: function(e, node) {
			var view = this.view,
				record = view.getRecord(node),
				y = e.getPageY(),
				noAppend = record.isLeaf(),
				region = Ext.fly(node).getRegion(),
				fragment;

			// If we are dragging on top of the root node of the tree, we always want to append.
			if (record.isRoot()) {
				return 'append';
			}

			// Return 'append' if the node we are dragging on top of is not a leaf else return false.
			if (this.appendOnly) {
				return noAppend ? false : 'append';
			}

			fragment = (region.bottom - region.top) / (noAppend ? 2 : 4);
		
			if (y >= region.top && y < (region.top + fragment)) {
				return 'before';
			}
			else if (y >= (region.bottom - fragment) && y <= region.bottom) {
				if (noAppend || !record.isExpanded()) {
					return 'after';
				}
				else if (record.isExpanded()) {
					return 'insert';
				}
			}
			return 'append';
		},

		// treat position 'insert' similar to after (for visual guides..)
		onNodeOver : function(node, dragZone, e, data) {
			var me = this,
				position = this.getPosition(e, node),
				returnCls = this.dropNotAllowed,
				view = this.view,
				targetNode = view.getRecord(node),
				indicator = this.getIndicator(),
				indicatorY = 0;

			// auto node expand check
			this.cancelExpand();

			if (this.collapseExpandedNodes && this.expanded.length) {
				var found = false;
				this.expanded = Ext.Array.filter(this.expanded, function(anc, idx, arr) {
					if (found) {
						anc.setCollapsed(true);
						return false;
					} else if (!targetNode.isAncestor(anc) && anc != targetNode) {
						view.collapse(anc, false, function() {
							// on collapse trigger move event again...
							me.notifyOver(dragZone, e, data);
						});
						found = true;
						return false;
					}
					return true;
				});
				if (found) {
					indicator.hide();
					return;
				}
			}
			
			if ((position == 'append' || position == 'after') && 
					!this.expandProcId && 
					!Ext.Array.contains(data.records, targetNode) && 
					!targetNode.isLeaf() && 
					!targetNode.isExpanded()) {
				this.queueExpand(targetNode, function() {
					// after expand, recall onNodeOver
					Ext.Function.defer(this.onNodeOver, 1, this, [node, dragZone, e, data]);
				});
			}
	
	
			if (this.isValidDropPoint(node, position, dragZone, e, data)) {
				this.valid = true;
				this.currentPosition = position;
				this.overRecord = targetNode;

				indicator.setWidth(Ext.fly(node).getWidth());
				indicatorY = Ext.fly(node).getY() - Ext.fly(view.el).getY() - 1;

				/*
				 * In the code below we show the proxy again. The reason for doing this is showing the indicator will
				 * call toFront, causing it to get a new z-index which can sometimes push the proxy behind it. We always 
				 * want the proxy to be above, so calling show on the proxy will call toFront and bring it forward.
				 */
				if (position == 'before') {
					returnCls = targetNode.isFirst() ? Ext.baseCSSPrefix + 'tree-drop-ok-above' : Ext.baseCSSPrefix + 'tree-drop-ok-between';
					indicator.showAt(0, indicatorY);
					dragZone.proxy.show();
				} else if (position == 'after' || position == 'insert') {
					returnCls = targetNode.isLast() ? Ext.baseCSSPrefix + 'tree-drop-ok-below' : Ext.baseCSSPrefix + 'tree-drop-ok-between';
					indicatorY += Ext.fly(node).getHeight();
					indicator.showAt(0, indicatorY);
					dragZone.proxy.show();
				} else {
					returnCls = Ext.baseCSSPrefix + 'tree-drop-ok-append';
					// @TODO: set a class on the parent folder node to be able to style it
					indicator.hide();
				}
			} else {
				this.valid = false;
			}

			this.currentCls = returnCls;
			return returnCls;
		},

		// handle container drop without which the behaviour is just awkward to use..
		onContainerOver : function(dd, e, data) {
			var view = this.view,
				targetNode = view.panel.getRootNode(),
				draggedRecords = data.records,
				dataLength = draggedRecords.length,
				showIndicator = true,
				indicator = this.getIndicator(),
				indicatorY = 0;

			if (this.collapseExpandedNodes && this.expanded.length) {
				Ext.Array.each(this.expanded, function(anc, idx, arr) {
					if ((idx == 0 && !anc.isRoot()) || (arr[0].isRoot() && idx == 1)) {
						view.collapse(anc, false, function() {
							// on collapse trigger move event again...
							me.notifyOver(dd, e, data);
						});
					} else {
						anc.setCollapsed(true);
					}
				});
				this.expanded = [];
				showIndicator = false;
			}

			if (targetNode && dataLength && 
					targetNode.get('allowDrop') !== false && 
					!Ext.Array.contains(draggedRecords, targetNode) &&
					view.fireEvent('nodedragover', targetNode, 'append', data, e) !== false) {
				this.valid = true;
				this.currentPosition = 'append';
				this.overRecord = targetNode;

				// show indicator
				if (showIndicator) {
					var count = view.store.getCount();
					if (count) {
					// Show indicator after last node
						var node = view.getNode(count - 1);
						indicator.setWidth(Ext.fly(node).getWidth());
						indicatorY = Ext.fly(node).getY() - Ext.fly(view.el).getY() - 1;
						indicatorY += Ext.fly(node).getHeight();
						indicator.showAt(0, indicatorY);
					} else {
						// No nodes, Show indicator at top
						indicator.setWidth(Ext.fly(view.el).getWidth()).showAt(0, 0);
					}
				} else {
					indicator.hide();
				}
				return Ext.baseCSSPrefix + 'tree-drop-ok-append';
			}
			return e.getTarget('.' + this.indicatorCls) ? this.currentCls : this.dropNotAllowed;
		},
	
		// handle position 'insert' dropping and make drop nodes the first children of the targetNode..
		// Filter out nodes that are children of selected nodes
		handleNodeDrop : function(data, targetNode, position) {
			var me = this,
				targetView = me.view,
				parentNode = targetNode ? targetNode.parentNode : targetView.panel.getRootNode(),
				Model = targetView.getStore().treeStore.model,
				insertionMethod, argList,
				needTargetExpand,
				transferData;

			// filter out children of other selected nodes
			if (this.nestedNodeSelection == 'unique') {
				data.records = Ext.Array.filter(data.records, function(item, pos, arr) {
					for (record = item.parentNode;record;record=record.parentNode) {
						if (Ext.Array.contains(arr, record)) {
							return false;
						}
					}
					return true;
				});
			}
		
			// If the copy flag is set, create a copy of the models
			if (data.copy) {
				data.records = Ext.Array.map(data.records, function(record, pos, arr) {
					if (record.isNode) {
						return record.copy(undefined, true);
					} else {
						// If it's not a node, make a node copy
						return new Model(record[record.persistenceProperty], record.getId());
					}
				});
			}

			// Cancel any pending expand operation
			me.cancelExpand();
			this.expanded = [];

			// Grab a reference to the correct node insertion method.
			// Create an arg list array intended for the apply method of the
			// chosen node insertion method.
			// Ensure the target object for the method is referenced by 'targetNode'
			if (position == 'before') {
				insertionMethod = parentNode.insertBefore;
				argList = [null, targetNode];
				targetNode = parentNode;
			}
			else if (position == 'after') {
				if (targetNode.nextSibling) {
					insertionMethod = parentNode.insertBefore;
					argList = [null, targetNode.nextSibling];
				}
				else {
					insertionMethod = parentNode.appendChild;
					argList = [null];
				}
				targetNode = parentNode;
			}
			else {
				if (!(targetNode.isExpanded() || targetNode.isLoading())) {
					needTargetExpand = true;
				}
				// INSERT CODE GOES HERE
				if (position == 'insert') {
					var counter = 0;
					insertionMethod = function(nd) {
						return this.insertChild(counter++,nd);
					};
				} else {
					insertionMethod = targetNode.appendChild;
				}
				argList = [null];
			}

			// A function to transfer the data into the destination tree
			transferData = function() {
				var color,
					n;

				// Coalesce layouts caused by node removal, appending and sorting
				Ext.suspendLayouts();

				targetView.getSelectionModel().clearSelections();

				// Insert the records into the target node
				for (i = 0, len = data.records.length; i < len; i++) {
					argList[0] = data.records[i];
					insertionMethod.apply(targetNode, argList);
				}

				// If configured to sort on drop, do it according to the TreeStore's comparator
				if (me.sortOnDrop) {
					targetNode.sort(targetNode.getOwnerTree().store.generateComparator());
				}
	
				Ext.resumeLayouts(true);

				// Kick off highlights after everything's been inserted, so they are
				// more in sync without insertion/render overhead.
				// Element.highlight can handle highlighting table nodes.
				if (Ext.enableFx && me.dropHighlight) {
					color = me.dropHighlightColor;

					for (i = 0; i < len; i++) {
						n = targetView.getNode(data.records[i]);
						if (n) {
							Ext.fly(n).highlight(color);
						}
					}
				}
			};

			// If dropping right on an unexpanded node, transfer the data after it is expanded.
			if (needTargetExpand) {
				targetNode.expand(false, transferData);
			}
			// If the node is waiting for its children, we must transfer the data after the expansion.
			// The expand event does NOT signal UI expansion, it is the SIGNAL for UI expansion.
			// It's listened for by the NodeStore on the root node. Which means that listeners on the target
			// node get notified BEFORE UI expansion. So we need a delay.
			// TODO: Refactor NodeInterface.expand/collapse to notify its owning tree directly when it needs to expand/collapse.
			else if (targetNode.isLoading()) {
				targetNode.on({
					expand: transferData,
					delay: 1,
					single: true
				});
			}
			// Otherwise, call the data transfer function immediately
			else {
				transferData();
			}
		}	
	});
});