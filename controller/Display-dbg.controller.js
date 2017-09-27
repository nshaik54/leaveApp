/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/myleaverequest/utils/utils",
	"hcm/fab/myleaverequest/utils/formatters",
	"hcm/fab/myleaverequest/controller/BaseController",
	"sap/ui/core/routing/History",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/format/DateFormat",
	"sap/m/Label",
	"sap/m/Text",
	"sap/m/LabelDesign",
	"sap/m/MessageBox",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem"
], function(utils, formatters, BaseController, History, JSONModel, DateFormat, Label, Text, LabelDesign, MessageBox, MessagePopover,
	MessagePopoverItem) {
	"use strict";

	/* global Promise */

	return BaseController.extend("hcm.fab.myleaverequest.controller.Display", {

		_oMessagePopover: null,
		formatter: formatters,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 */
		onInit: function() {
			this.oErrorHandler = this.getOwnerComponent().getErrorHandler();

			this._oNotesModel = new JSONModel({
				NoteCollection: []
			});
			this.setModel(this._oNotesModel, "noteModel");

			this.getRouter().getRoute("display").attachPatternMatched(this._onDisplayMatched, this);
			this._oLocalModel = this.getOwnerComponent().getModel("local");
			this._oLocalModel.setProperty("/notdataloading", false);
			this._oLocalModel.setProperty("/busy", true);
			this._oLocalModel.setProperty("/display-editEnabled", false);
			this._oLocalModel.setProperty("/display-withdrawEnabled", false);
			this.getOwnerComponent().getAssignmentId().then(function(sEmployeeId) {
				this._oLocalModel.setProperty("/display-employeeId", sEmployeeId);
			}.bind(this));
		},

		onExit: function() {
			this.oErrorHandler.clearErrors();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		onEditRequest: function(oEvent) {
			utils.navTo.call(this, "edit", {
				leavePath: oEvent.getSource().getBindingContext().getPath().substr(1)
			});
		},

		onDeleteRequest: function(oEvent) {
			var oComponent = this.getOwnerComponent(),
				sBindingPath = oEvent.getSource().getBindingContext().getPath();

			// get user confirmation first			
			MessageBox.confirm(this.getResourceBundle().getText("confirmDeleteMessage"), {
				styleClass: oComponent.getContentDensityClass(),
				initialFocus: MessageBox.Action.CANCEL,
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._deleteRequest(sBindingPath);
					}
				}.bind(this)
			});
		},

		onHandlePopover: function(oEvent) {
			var oMessagesButton = oEvent.getSource(),
				oView = this.getView();
			if (!this._oMessagePopover) {
				this._oMessagePopover = new MessagePopover({
					items: {
						path: "message>/",
						template: new MessagePopoverItem({
							description: "{message>description}",
							type: "{message>type}",
							title: "{message>message}",
							subtitle: "{message>additionalText}"
						})
					}
				});
				jQuery.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), oView, this._oMessagePopover);
				oView.addDependent(this._oMessagePopover);
			}
			this._oMessagePopover.toggle(oMessagesButton);
		},

		onNavBack: function() {
			this.oErrorHandler.clearErrors();

			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				oCrossAppNavigator.toExternal({
					target: {
						shellHash: "#"
					}
				});
			}
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		_onDisplayMatched: function(oEvent) {
			this.oErrorHandler.clearErrors();
			var oParameter = oEvent.getParameter("arguments");
			this.getModel().metadataLoaded().then(function() {
				var sObjectPath = oParameter.leavePath;
				this._bindView("/" + sObjectPath);
			}.bind(this));
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function(sLeavePath) {
			// Set busy indicator during view binding
			var oLocalModel = this._oLocalModel;
			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oLocalModel.setProperty("/notdataloading", true);

			/*
			 * Currently we cannot navigate directly to a display page because
			 * ids of a leave request always change when the app is first
			 * opened. Therefore we must navigate to the overview page in these
			 * case.
			 */
			if (!this.getView().getModel().getProperty(sLeavePath)) {
				utils.navTo.call(this, "overview", true);
				return;
			}

			var oContext = new sap.ui.model.Context(this.getView().getModel(), sLeavePath);
			this.getView().setBindingContext(oContext);

			var oLeaveRequest = oContext.getProperty(sLeavePath);

			//transform notes (temporary solution!)
			var sNoteString = oLeaveRequest.Notes,
				aNotes = this.formatter.formatNotes(sNoteString);
			this._oNotesModel.setProperty("/NoteCollection", aNotes);

			//transform attachments
			var aAttachments = Array.apply(null, {
				length: 5
			}).map(function(oUndefined, iIdx) {
				return oLeaveRequest["Attachment" + (iIdx + 1)];
			}).filter(function(oAttachment) {
				return oAttachment.FileName !== "";
			});

			oLocalModel.setProperty("/attachments", aAttachments);
			oLocalModel.setProperty("/notdataloading", true);
			oLocalModel.setProperty("/busy", false);

			this._setButtonStates();
		},

		/**
		 * Deletes the corresponding leave request from the ODATA-model
		 * @function
		 * @param {string} sBindingPath path to the leave request object in the model
		 * @private
		 */
		_deleteRequest: function(sBindingPath) {
			this._oLocalModel.setProperty("/busy", true);
			this.getView().getModel().remove(sBindingPath, {
				success: function() {
					this._oLocalModel.setProperty("/busy", false);
					MessageBox.information(this.getResourceBundle().getText("deletedSuccessfully"), {
						title: this.getResourceBundle().getText("deleteLeaveRequest"),
						onClose: function() {
							//send event to refresh the overview page
							sap.ui.getCore().getEventBus().publish("hcm.fab.myleaverequest", "invalidateoverview", "refresh");
							//navigate to the List
							utils.navTo.call(this, "overview");
						}.bind(this)
					});
				}.bind(this),
				error: function(oError) {
					// TODO: add error handler
				}
			});
		},

		// /**
		//  * Event handler for binding change event
		//  * @function
		//  * @private
		//  */

		// _onBindingChange: function() {
		// 	var oView = this.getView(),
		// 		oElementBinding = oView.getElementBinding();

		// 	// No data for the binding
		// 	if (!oElementBinding.getBoundContext()) {
		// 		utils.navTo.call(this, "overview", true);
		// 		return;
		// 	}

		// 	var oLeaveRequestToEdit = oView.getBindingContext();

		// 	var aAttachments = Array(5).fill().map(function(oUndefined, iIdx) {
		// 		return oLeaveRequestToEdit["Attachment" + (iIdx + 1)];
		// 	}).filter(function(oAttachment) {
		// 		return oAttachment.FileName !== "";
		// 	});

		// 	this._oLocalModel.setProperty("/attachments", aAttachments);

		// 	this._setButtonStates();
		// },

		// _onObjectMatched: function(oEvent) {
		// 	this.oErrorHandler.setShowErrors("immediately");

		// 	var that = this,
		// 		oView,
		// 		aAttachments,
		// 		oContext,
		// 		oLocalModel,
		// 		sLeavePath,
		// 		oViewModel,
		// 		oRouteArgs;

		// 	oRouteArgs = oEvent.getParameter("arguments");
		// 	this._leavePath = oRouteArgs.leavePath;
		// 	sLeavePath = "/" + this._leavePath;

		// 	oView = this.getView();
		// 	oViewModel = oView.getModel();
		// 	oLocalModel = this.getOwnerComponent().getModel("local");

		// 	var oAssignmentPromise = this.getOwnerComponent().getAssignmentId();
		// 	oAssignmentPromise.then(function(sAssignmentId) {
		// 		var sEmployeeId = sAssignmentId;
		// 		that._initModel(sEmployeeId);

		// 		/*
		// 		 * Currently we cannot navigate directly to a display page because
		// 		 * ids of a leave request always change when the app is first
		// 		 * opened. Therefore we must navigate to the overview page in these
		// 		 * case.
		// 		 */
		// 		if (!oViewModel.getProperty(sLeavePath)) {
		// 			utils.navTo.call(that, "overview", true);
		// 			// TODO: implement that
		// 			// that.getView().bindElement( {path: oEv, events: {dataReceived:function(oEvent) { 
		// 			//         localModel.setProperty("/notdataloading",true);
		// 			//         localModel.setProperty("/busy",false);
		// 			//     }
		// 			// }});
		// 			return;
		// 		}

		// 		// render leave request display page
		// 		oContext = new sap.ui.model.Context(oViewModel, sLeavePath);
		// 		that.oView.unbindElement();
		// 		that.oView.setBindingContext(oContext);

		// 		var oLeaveRequestToEdit = oContext.getProperty(sLeavePath);

		// 		aAttachments = Array(5).fill().map(function(oUndefined, iIdx) {
		// 			return oLeaveRequestToEdit["Attachment" + (iIdx + 1)];
		// 		}).filter(function(oAttachment) {
		// 			return oAttachment.FileName !== "";
		// 		});

		// 		oLocalModel.setProperty("/attachments", aAttachments);
		// 		oLocalModel.setProperty("/notdataloading", true);
		// 		oLocalModel.setProperty("/busy", false);
		// 		that._setButtonStates();
		// 	});
		// },

		_initModel: function(sEmployeeId) {
			var oLocalModel = this.getView().getModel("local");
			oLocalModel.setProperty("/display-editEnabled", false);
			oLocalModel.setProperty("/display-withdrawEnabled", false);
			oLocalModel.setProperty("/display-employeeId", sEmployeeId);
		},

		_setButtonStates: function() {
			var oLocalModel = this.getView().getModel("local");
			var oContext = this.getView().getBindingContext();
			var bEdit = false;
			var bWithdraw = false;
			var bEditIndicator, bDeleteIndicator;

			bEditIndicator = oContext.getProperty("IsModifiable");
			bDeleteIndicator = oContext.getProperty("IsDeletable");
			//@TODO: there should be some for related requests need to find out what this means...
			bEdit = bEditIndicator;
			bWithdraw = bDeleteIndicator;
			oLocalModel.setProperty("/display-editEnabled", bEdit);
			oLocalModel.setProperty("/display-withdrawEnabled", bWithdraw);
		},

		/* =====================*/
		/* attachment functions */
		/* =====================*/
		_attachmentDateTimeFormatter: function() {
			var oDateTimeFormat = DateFormat.getDateTimeInstance();
			return oDateTimeFormat.format(new Date());
		},

		_attachmentUrlFormatter: function(sAttachmentId, sFileName) {
			var oModel = this.getView().getModel();
			var oContext = this.getView().getBindingContext();
			var sEmployeeId = oContext.getProperty("EmployeeID");
			var sRequestId = oContext.getProperty("RequestID");

			return oModel.sServiceUrl + [
				"/FileAttachmentSet(EmployeeID='" + sEmployeeId + "'",
				"LeaveRequestId='" + sRequestId + "'",
				"ArchivDocId='" + sAttachmentId + "'",
				"FileName='" + sFileName + "')/$value"
			].join(",");
		}

		// _renderAdditionalFields: function(oAddFields, oAddFieldProp) {
		// 	var oModel = this.getView().getModel();
		// 	var oForm = this.getView().byId("fieldForm");

		// 	//make a util function to share with creation controller?
		// 	var fGetProps = function(sFieldName, aFieldProps) {
		// 		for (var i = 0; i < aFieldProps.length; i++) {
		// 			if (aFieldProps[i].NAME === sFieldName) {
		// 				return aFieldProps[i];
		// 			}
		// 		}
		// 		return undefined;
		// 	};

		// 	var aAddFields, oAddField, sBindingPath, oAddFieldProps, oValueControl, sLabelId, sId, oLabel;
		// 	try {
		// 		aAddFields = JSON.parse(oAddFieldProp);
		// 	} catch (ex) {
		// 		var empty = 0;
		// 	}
		// 	for (var i = 0; oAddFields.length > i; i++) {
		// 		oAddField = oModel.getProperty("/" + oAddFields[i]);
		// 		sBindingPath = "toAdditionalFieldsDefinition/" + oAddField.Fieldname;
		// 		oAddFieldProps = fGetProps(oAddField.Fieldname, aAddFields);
		// 		oValueControl = undefined;
		// 		sId = this.getView().createId("AddField:" + oAddField.Fieldname);
		// 		if (oAddFieldProps) {
		// 			switch (oAddFieldProps.TYPE_KIND) {
		// 				case "D": //date
		// 					oValueControl = new Text(sId, {
		// 						text: {
		// 							path: sBindingPath,
		// 							mode: sap.ui.model.BindingMode.TwoWay,
		// 							type: new sap.ui.model.odata.type.DateTime({}, {
		// 								displayFormat: "Date"
		// 							})
		// 						}
		// 					});
		// 					break;
		// 				case "T": //Time
		// 					oValueControl = new Text(sId, {
		// 						text: {
		// 							path: sBindingPath,
		// 							mode: sap.ui.model.BindingMode.TwoWay,
		// 							type: new sap.ui.model.odata.type.Time({
		// 								pattern: "HH:mm"
		// 							})
		// 						}
		// 					});
		// 					break;

		// 				case "C":
		// 				default:
		// 					oValueControl = new Text(sId, {
		// 						text: {
		// 							path: sBindingPath,
		// 							mode: sap.ui.model.BindingMode.TwoWay
		// 						}
		// 					});
		// 					break;
		// 			}
		// 		}
		// 		if (oValueControl) {
		// 			sLabelId = this.getView().createId("AddFieldLabel:" + oAddField.Fieldname);
		// 			oLabel = new Label(sLabelId, {
		// 				text: oAddField.FieldLabel,
		// 				design: LabelDesign.Bold
		// 			});
		// 			oForm.addContent(oLabel);
		// 			oForm.addContent(oValueControl);
		// 		} else {
		// 			var error = "Could not create control for additional Field " + oAddField.Fieldname;
		// 		}
		// 	}
		// }
	});
});