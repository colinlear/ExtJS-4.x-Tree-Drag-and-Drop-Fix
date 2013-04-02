ExtJS 4.x Tree Fixes: Drag and Drop
===================================

This fixes several bugs in the drop functionality for trees.

There is similar code posted in the forums and elsewhere, but I've made this available here since I wrote similar fixes for the [ExtJS 3.x trees](https://github.com/colinlear/ExtJS-3.x-Multiselect---Drag-Drop-Tree "ExtJS 3.x MultiSelect Drag and Drop Tree").

Fixes
-----

* allowContainerDrops functionality implemented & permanently enabled.
* allowContainerInserts functionality removed (it was stupid).
* Prevent nested selections from being 'dropped' separately from selected ancestor 
(Option *nestedNodeSelection*.)
* Track nodes expanded by hovering and collapse again (Option *collapseExpandedNodes*.)

Usage
-----

Require fixes.TreeDND and it should work (assuming after Ext.tree.*)

	Ext.require([
		'Ext.tree.*',
		'Ext.data.Model',
		'Ext.util.Point',
		'fixes.TreeDnD'
	]);

See tree-demo.html for example tree code.

Notes
-----

* collapseExpandedNodes option defaults to true, change to false to disable.
* allowContainerDrops option is ignored, prevent drops on the root node to disable the 
feature.
* collapseExpandedNodes option is pretty terrible, was implemented just to see if it was 
possible.
* nestedNodeSelection option only applies on drop, the floating drag proxy still shows 
all the selected nodes, and all the events see all the nodes too.
* This code is highly derivative of the original src/tree/ViewDropZone.js file and hence 
GPL 3.0
* Commercial Licensees of ExtJS can use this without additional restriction, subject to
permission from Sencha Inc. Contact Them if you are not sure.

