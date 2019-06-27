//original button
$(document).ready(function(){
	setTimeout(function() {
		var url = window.location.href;
		//works on My Work, Team Work, or All Work. The GUIDs of those pages are seen here are in the identical order.
		if ((url.indexOf("cca5abda-6803-4833-accd-d59a43e2d2cf") > 0 ) || (url.indexOf("f94d43eb-eb42-4957-8c48-95b9b903c631") > 0 ) || (url.indexOf("62f452d5-66b5-429b-b2b1-b32d5562092b") > 0 ))
		{
				var vm = new kendo.observable({
				targetControlId: ""
			})
			app.events.subscribe("gridChange", function(event, grid) {
				vm.targetControlId = $(grid.wrapper).attr('id');
			});

			//functions
			function CommitParentChildIncidents (workitemID, tpid, childIncidents)
			{
				$.ajax({
					type: 'GET',
					url: '/api/V3/Projection/GetProjection',
					data: { id: workitemID, typeProjectionId: tpid },
					contentType: "application/json",
					dataType: 'json',
					success: function(data) {
						console.log('Projection retrieved for Parent: ' + data.Id);
						//console.log(data);

						$.each(childIncidents, function(i,e)
						{
							try
								{
									//console.log(childIncidents[i].responseJSON);
								if ((childIncidents[i].responseJSON.ClassName === "System.WorkItem.Incident") && (childIncidents[i].responseJSON.IsParent != true))
								{
									var originalChild = childIncidents[i].responseJSON
									var updatedChild = childIncidents[i].responseJSON

									updatedChild.ParentWorkItem = data;
									//console.log(originalChild);
									
									CommitWorkItem(updatedChild, originalChild, "Parent/Child Update");
									console.log('Linked ' + updatedChild.Id + ' to ' + data.Id);
								}
							}
							catch
							{
								console.log('Either this was not an Incident or it was already a parent incident.')
							}
						});
					},
				});
			}

			function GetProjection(workitemID, tpid)
			{
				return $.ajax({
					type: 'GET',
					url: '/api/V3/Projection/GetProjection',
					data: { id: workitemID, typeProjectionId: tpid },
					contentType: "application/json",
					dataType: 'json',
					success: function(data) {
						if (data.Id)
						{
							console.log('Work Item Projection retrieved for: ' + data.Id);
							//console.log(data);
						}
						else
						{
							console.log('Work Item Projection could not be retrieved for: ' + data.Id + ' with Projection ID ' + tpid);
							//console.log(data);
						}
					},
					error: function (data) {
						console.log('Work Item Projection could not be retrieved for: ' + data.Id + ' with Projection ID ' + tpid);
					  }
				});
			}

			//save the Work Item - pass it the original WI json and the changed one
			function CommitWorkItem (updatedWIJSON, originalWIJSON, actionType)
			{
				//commit the Problem to SCSM
				var strData = { "formJson":{ "current": updatedWIJSON, "original": originalWIJSON } };
				$.ajax({
					type: 'POST',
					url: '/api/V3/Projection/Commit',
					data: JSON.stringify(strData),
					contentType: "application/json",
					dataType: 'json',
					success: function() {
						console.log(actionType+':' + updatedWIJSON.Id);
					},
				});
			}

			//Drawer Tasks
			//Link to Parent Incident, asks for a Parent Incident
			var linkToParentTag = '<li id="LinkToParentIR"><a>Link to Parent Incident</a></li>';
			$('.drawer-task-menu').append(linkToParentTag);
			$('#LinkToParentIR').bind('click', function()
			{
				if (vm.targetControlId)
				{
					var gridId = "#" + vm.targetControlId;
					var grid = $(gridId).getKendoGrid();
					var irSelection = grid.select();
					
					//create an empty array to hold the selected work items
					var selectedIRArray = [];
					//for each Work Item selected add to an array
					console.log('Selected the following Incidents for Parent Link')
					$.each(irSelection, function(i,e)
					{
						var griditem = grid.dataItem(irSelection[i])
						selectedIRArray.push(GetProjection(griditem.Id, "2d460edd-d5db-bc8c-5be7-45b050cba652"));
					});

					//load the form
					require(["text!/CustomSpace/drawerTasks/RelateToWorkItem.html"], function (template) { 
						//make a jQuery obj 
						cont = $(template); 
						
						//create a view model to handle the UX 
						var _vmWindow = new kendo.observable({ 
							searchText: "",
							searchClick: function () {
								var val = this.get("searchText");
								this.refreshDataSource();
								this.dataSource.filter({
									logic: "or",
									filters: [
										{
											field: "Id",
											operator: "contains",
											value: val
										},
										{
											field: "Title",
											operator: "contains",
											value: val
										},
										{
											field: "Status.Name",
											operator: "contains",
											value: val
										}
									]
								});
							},
							okEnabled: false, 
							okClick: function () {
								if (!this.selectedRow)
									return;

								//get the selected Item which is the Parent Incident to relate
								console.log('Selected a Parent from Popup')
								var ParentIncident = this.selectedRow;
								CommitParentChildIncidents(ParentIncident.Id, "039bc84f-cfe2-4e7e-9201-208929b252cd", selectedIRArray)	
								
								this.dataSource.filter([]);
								win.close();
							},
							cancelClick: function () {
								this.dataSource.filter([]);
								win.close();
							},
							dataSource: new kendo.data.DataSource({
								transport: {
									read: {
										type: "GET",
										dataType: "json",
										url: "/Search/GetParentWorkItems",
										data: { workItemType: vm.type },
										cache: false
									}
								},
								schema: {
									model: {
										fields: {
											Id: { type: "string" },
											Title: { type: "string" },
											Status: { type: "string" },
											BaseId: { type: "string" }
										}
									}
								},
								pageSize: 10,
							}),
							selectedRow: null,
							gridChange: function (eventArgs) {
								this.set("okEnabled", true);
								this.set("selectedRow", eventArgs.sender.dataItem(eventArgs.sender.select()));
							},
							refreshDataSource: function () {
								this.dataSource.read();
							}
						}); 

						//create the kendo window 
						win = cont.kendoWindow({ 
							title: "Link to Parent Incident", 
							resizable: false, 
							modal: true, 
							viewable: false, 
							width: 700, 
							height: 700, 
							close: function () { }, 
							activate: function () { 
								//on window activate bind the view model to the loaded template content 
								kendo.bind(cont, _vmWindow);
							} 
						}).data("kendoWindow");

						//now open the window 
						win.open().center();
					});
				}
			});

			//Unlink from Parent
			var unlinkParentTag = '<li id="UnlinkFromParent"><a>Unlink from Parent Incident</a></li>';
			$('.drawer-task-menu').append(unlinkParentTag);
			$('#UnlinkFromParent').bind('click', function()
			{
				if (vm.targetControlId)
				{
					var gridId = "#" + vm.targetControlId;
					var grid = $(gridId).getKendoGrid();
					var irSelection = grid.select();
					
					//create an empty array to hold the selected work items
					var selectedChildIRArray = [];
					//for each Work Item selected add to an array
					console.log('Selected the following Incidents for Parent Unlink')
					$.each(irSelection, function(i,e)
					{
						//JSON.parse(JSON.stringify(selectedIRArray[i]));
						var workitem = grid.dataItem(irSelection[i])
					
						$.ajax({
							type: 'GET',
							url: '/api/V3/Projection/GetProjection',
							data: { id: workitem.Id, typeProjectionId: "2d460edd-d5db-bc8c-5be7-45b050cba652" },
							contentType: "application/json",
							dataType: 'json',
							success: function(data) {
								try
								{
									console.log('Retrieved Incident projection for removal: ' + data.Id);
									//console.log(data);

									var incidentToEvaluate = data;
									if ((incidentToEvaluate.IsParent != true) && (incidentToEvaluate.ClassName === 'System.WorkItem.Incident'))
									{
										console.log('Unlinking ' + incidentToEvaluate.Id + ' from ' + incidentToEvaluate.ParentWorkItem.Id);
										var updatedChild = JSON.parse(JSON.stringify(incidentToEvaluate));
										updatedChild.ParentWorkItem.BaseId = null;

										CommitWorkItem(updatedChild, incidentToEvaluate, 'Unlink');
									}
									else if ((incidentToEvaluate.IsParent === true) && (incidentToEvaluate.ClassName === 'System.WorkItem.Incident'))
									{
										console.log('This is already a Parent, you cannot do that. Skipping.');
									}
									else {
										console.log('');
									}
								}
								catch
								{
									console.log('Selection was either was not an Incident or not a Child to unlink.');
								}

							},
						});

					});
				}
			});

			//Leave First Response/Comment
			var commentTag = '<li id="newcomment"><a>Add A Comment</a></li>';
			$('.drawer-task-menu').append(commentTag);
			$('#newcomment').bind('click', function()
			{
				if (vm.targetControlId)
				{
					var gridId = "#" + vm.targetControlId;
					var grid = $(gridId).getKendoGrid();
					var wiSelection = grid.select();
					
					//Getting workitems data and storing it in selectedWIArray
					console.log('Selected the following Work Items for Commenting')
					var selectedWIArray = [];
					$.each(wiSelection, function(i,e)
					{
						var workitem = grid.dataItem(wiSelection[i])
						selectedWIArray.push(workitem);
						console.log(workitem.Id);
					});

					require(["text!/CustomSpace/drawerTasks/NewComment.html"], function (template) { 
						//make a jQuery obj 
						cont = $(template); 
						
						//create a view model to handle the UX 
						var _vmWindow = new kendo.observable({ 
							leavePrivateComment: false,
							analystComment: "",
							okEnabled: false, 
							charactersRemaining: "4000", 
							textCounter: function () { 
								var maximumLength = 4000; 
								var val = this.analystComment.length; 
								(val > maximumLength) ? this.analystComment.substring(0, maximumLength) : this.set("charactersRemaining", maximumLength - val); 
								(val > 0) ? this.set("okEnabled", true) : this.set("okEnabled", false); 
							},
							clickHandler: function(e) {
								var privateCommentValue = e.data.leavePrivateComment;
								//console.log('Click handler: ' + privateCommentValue);
							},
							okClick: function () {
								var analystComment = this.get("analystComment");
								var isPrivateChecked = this.get("leavePrivateComment");

								//foeach loop begins
								selectedWIArray.forEach(function(wi) {
									if((wi.WorkItemType === "System.WorkItem.Incident") || (wi.WorkItemType === "System.WorkItem.Problem"))
									{
										var ProjectionID;
										if (wi.WorkItemType === "System.WorkItem.Incident"){ProjectionID = "2d460edd-d5db-bc8c-5be7-45b050cba652"}
										if  (wi.WorkItemType === "System.WorkItem.Problem"){ProjectionID = "aa6d17ac-0ed8-5d86-d862-cff4cd8792fa"} 
										$.ajax({
											type: 'GET',
											url: '/api/V3/Projection/GetProjection',
											data: { id: wi.Id, typeProjectionId: ProjectionID },
											contentType: "application/json",
											dataType: 'json',
											success: function(data) {
												var wiToEvaluate = data;
												var updatedWI = JSON.parse(JSON.stringify(wiToEvaluate));
														updatedWI.AppliesToTroubleTicket.push({
															EnteredBy: window['session'].user.Name,
															Title: "Analyst Comment",
															IsPrivate: isPrivateChecked,
															EnteredDate: new Date().toISOString(),
															LastModified: new Date().toISOString(),
															Description: analystComment,
															ActionType: "AnalystComment"
													});
												CommitWorkItem(updatedWI, wiToEvaluate, "Commenting");
											},
										});
									};
									if((wi.WorkItemType === "System.WorkItem.ServiceRequest") || (wi.WorkItemType === "System.WorkItem.ChangeRequest"))
									{
										var ProjectionID;
										if (wi.WorkItemType === "System.WorkItem.ServiceRequest"){ProjectionID = "7ffc8bb7-2c2c-0bd9-bd37-2b463a0f1af7"}
										if  (wi.WorkItemType === "System.WorkItem.ChangeRequest"){ProjectionID = "4c8f4f06-4c8f-a1b6-c104-89cfb7b593fa"} 
										$.ajax({
											type: 'GET',
											url: '/api/V3/Projection/GetProjection',
											data: { id: wi.Id, typeProjectionId: ProjectionID },
											contentType: "application/json",
											dataType: 'json',
											success: function(data) {
												var wiToEvaluate = data;
												var updatedWI = JSON.parse(JSON.stringify(wiToEvaluate));
														updatedWI.AppliesToWorkItem.push({
															EnteredBy: window['session'].user.Name,
															Title: "Analyst Comment",
															IsPrivate: isPrivateChecked,
															EnteredDate: new Date().toISOString(),
															LastModified: new Date().toISOString(),
															Description: analystComment,
															ActionType: "AnalystComment"
													});
												CommitWorkItem(updatedWI, wiToEvaluate, "Commenting");
											},
										});
									};
								});
								win.close();	
							},
							cancelClick: function () {
								win.close();
							},
						}); 
						//create the kendo window 
						win = cont.kendoWindow({ 
							title: "Add A Comment", 
							resizable: false, 
							modal: true, 
							viewable: false, 
							width: 700, 
							height: 500, 
							close: function () {}, 
							activate: function () { 
								//on window activate bind the view model to the loaded template content 
								kendo.bind(cont, _vmWindow);
							} 
						}).data("kendoWindow");
						//now open the window 
						win.open().center();
					})
				}
			});

			//Relate to Work Item
			var linkToWorkItemTag = '<li id="RelateToWI"><a>Relate to Work Item</a></li>';
			$('.drawer-task-menu').append(linkToWorkItemTag);
			$('#RelateToWI').bind('click', function()
			{
				if (vm.targetControlId)
				{
					var gridId = "#" + vm.targetControlId;
					var grid = $(gridId).getKendoGrid();
					var wiSelection = grid.select();
					
					//create an empty array to hold the selected work items
					var selectedWIArray = [];
					//for each Work Item selected add to an array
					console.log('Selected the following Incidents for Work Item Relate')
					$.each(wiSelection, function(i,e)
					{
						var griditem = grid.dataItem(wiSelection[i])
						if (griditem.WorkItemType === "System.WorkItem.Incident")
						{
							var ProjectionID = "2d460edd-d5db-bc8c-5be7-45b050cba652"
							selectedWIArray.push(GetProjection(griditem.Id, ProjectionID));
						}
						else if (griditem.WorkItemType === "System.WorkItem.Problem")
						{
							var ProjectionID = "aa6d17ac-0ed8-5d86-d862-cff4cd8792fa"
							selectedWIArray.push(GetProjection(griditem.Id, ProjectionID));
						}
						else if (griditem.WorkItemType === "System.WorkItem.ServiceRequest")
						{
							var ProjectionID = "7ffc8bb7-2c2c-0bd9-bd37-2b463a0f1af7"
							selectedWIArray.push(GetProjection(griditem.Id, ProjectionID));
						}
						else if (griditem.WorkItemType === "System.WorkItem.ChangeRequest")
						{
							var ProjectionID = "4c8f4f06-4c8f-a1b6-c104-89cfb7b593fa"
							selectedWIArray.push(GetProjection(griditem.Id, ProjectionID));
						}
						else
						{
							console.log('Must be an Incident, Problem, Service or Change Request');
						}
					});

					//load the form
					require(["text!/CustomSpace/drawerTasks/RelateToWorkItem.html"], function (template) { 
						//make a jQuery obj 
						cont = $(template); 
						
						//create a view model to handle the UX 
						var _vmWindow = new kendo.observable({ 
							searchText: "",
							searchClick: function () {
								var val = this.get("searchText");
								this.refreshDataSource();
								this.dataSource.filter({
									logic: "or",
									filters: [
										{
											field: "Id",
											operator: "contains",
											value: val
										},
										{
											field: "Title",
											operator: "contains",
											value: val
										}
									]
								});
							},
							okEnabled: false, 
							okClick: function () {
								if (!this.selectedRow)
									return;
								
								//get the selected Work Item to relate the selection to
								console.log('Selected a Work Item to relate from Popup')
								//loop and relate
								var selectedWorkItemRow = this.selectedRow;
								switch(selectedWorkItemRow.WorkItemType) {
									case "System.WorkItem.Incident":
										var ProjectionID = "2d460edd-d5db-bc8c-5be7-45b050cba652";
										break;
									case "System.WorkItem.Problem":
										var ProjectionID = "aa6d17ac-0ed8-5d86-d862-cff4cd8792fa";
									  	break;
									case "System.WorkItem.ServiceRequest":
										var ProjectionID = "7ffc8bb7-2c2c-0bd9-bd37-2b463a0f1af7";
										break;
									case "System.WorkItem.ChangeRequest":
										var ProjectionID = "4c8f4f06-4c8f-a1b6-c104-89cfb7b593fa";
										break;
								  }

								  $.ajax({
									type: 'GET',
									url: '/api/V3/Projection/GetProjection',
									data: { id: selectedWorkItemRow.Id, typeProjectionId: ProjectionID },
									contentType: "application/json",
									dataType: 'json',
									success: function(data) {
										var TargetWorkItem = data;
										selectedWIArray.forEach(function(wi)
										{
											var originalWorkItem = wi.responseJSON;
											var updatedWorkItem = JSON.parse(JSON.stringify(wi)).responseJSON;
											console.log('Going to relate ' + updatedWorkItem.Id + ' to ' + TargetWorkItem.Id);
											try
											{
												//items are already related, add to the array
												updatedWorkItem.RelatesToWorkItem.push(TargetWorkItem);
											}
											catch
											{
												//no related items exist, set the first item in the array
												updatedWorkItem.RelatesToWorkItem = TargetWorkItem;
											}

											CommitWorkItem(updatedWorkItem, originalWorkItem, "Relate");
										});
									}
								});

								this.dataSource.filter([]);
								win.close();
							},
							cancelClick: function () {
								this.dataSource.filter([]);
								win.close();
							},
							dataSource: new kendo.data.DataSource({
								transport: {
									read: {
										dataType: "json",
										url: "/api/V3/WorkItem/GetGridWorkItemsAll",
										data: {
											"userId": session.user.Id,
											"isScoped": false,
											"showActivities": false,
											"showInactiveItems": false
										},
										type: "GET"
									}
								},
								schema: {
									model: {
										fields: {
											Id: { type: "string" },
											Title: { type: "string" },
											Status: { type: "string" },
											BaseId: { type: "string" }
										}
									}
								},
								pageSize: 10,
							}),
							selectedRow: null,
							gridChange: function (eventArgs) {
								this.set("okEnabled", true);
								this.set("selectedRow", eventArgs.sender.dataItem(eventArgs.sender.select()));
							},
							refreshDataSource: function () {
								this.dataSource.read();
							}
						}); 

						//create the kendo window 
						win = cont.kendoWindow({ 
							title: "Relate to Work Item", 
							resizable: false, 
							modal: true, 
							viewable: false, 
							width: 700, 
							height: 700, 
							close: function () { }, 
							activate: function () { 
								//on window activate bind the view model to the loaded template content 
								kendo.bind(cont, _vmWindow);
							} 
						}).data("kendoWindow");

						//now open the window 
						win.open().center();
					});
				}
			});

		}
	}, 2000);
}) 