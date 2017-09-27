/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/myleaverequest/utils/formatters",
	"hcm/fab/myleaverequest/utils/utils",
	"hcm/fab/myleaverequest/controller/BaseController",
	"sap/ui/Device",
	"sap/ui/core/routing/History",
	"sap/ui/model/Filter",
	"sap/ui/base/Event",
	"sap/m/Title",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/UploadCollectionParameter",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/format/DateFormat",
	"sap/ui/core/format/NumberFormat",
	"hcm/fab/lib/common/controls/TeamCalendarControl",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/StandardListItem"
], function(formatter, utils, BaseController, Device, History, Filter, Event, Title, Label, Input, MessagePopover, MessagePopoverItem,
	MessageToast,
	MessageBox,
	UploadCollectionParameter, JSONModel,
	DateFormat, NumberFormat, TeamCalendarControl, Dialog, Button, StandardListItem) {
	"use strict";

	var I_MAX_APPROVERS = 5;
	var I_MAX_ATTACHMENTS = 5;

	var O_SEARCH_HELPER_MAPPINGS = {
		"CompCode": {
			keyField: "CompanyCodeID",
			titleField: "CompanyCodeID",
			descriptionField: "CompanyCodeText",
			searchFields: "CompanyCodeID,CompanyCodeText" // , = "or"
		},
		"DescIllness": { // Desc. Illness
			keyField: "IllnessCode",
			titleField: "IllnessCode",
			descriptionField: "IllnessDescTxt",
			searchFields: "IllnessCode,IllnessDescTxt"
		},
		"CostCenter": {
			keyField: "CostCenterID",
			titleField: "CostCenterID",
			descriptionField: "CostCenterText",
			searchFields: "CostCenterID,CostCenterText"
		},
		"OtCompType": { // OT comp. type
			keyField: "OverTimeCompID",
			titleField: "OverTimeCompID",
			descriptionField: "OverTimeCompText",
			searchFields: "OverTimeCompID,OverTimeCompText"
		},
		"TaxArea": { // Tax Area
			keyField: "WorkTaxAreaID",
			titleField: "WorkTaxAreaID",
			descriptionField: "WorkTaxAreaDesciption",
			searchFields: "WorkTaxAreaDesciption"
		},
		"ObjectType": {
			keyField: "ObjtypeID",
			titleField: "ObjtypeID",
			descriptionField: "ObjTypetext",
			searchFields: "ObjtypeID,ObjTypetext"
		},
		"WageType": { // Wage Type
			keyField: "WageTypeID",
			titleField: "WageTypeID",
			descriptionField: "WageTypeText",
			searchFields: "WageTypeID,WageTypeText"
		},
		"OrderID": { // Order
			keyField: "OrderNumID",
			titleField: "OrderNumID",
			descriptionField: "OrderNumText",
			searchFields: "OrderNumID,OrderNumText"
		}
	};

	/**
	 * Sets the error state of controls that use a data type.
	 *
	 * @param {object} oEvent
	 *   the event raised by UI5 when validation occurs.
	 */
	function controlErrorHandler(oEvent) {
		var oControl = oEvent.getParameter("element");
		var sErrorMessage = oEvent.getParameter("message");

		if (oControl && oControl.setValueStateText && sErrorMessage) {
			oControl.setValueStateText(sErrorMessage);
		}
		if (oControl && oControl.setValueState) {
			oControl.setValueState("Error");
		}
	}
	/**
	 * Sets the normal state of controls that passed a validation.
	 *
	 * @param {object} oEvent
	 *   the event raised by UI5 when validation occurs.
	 */
	function controlNoErrorHandler(oEvent) {
		var oControl = oEvent.getParameter("element");
		if (oControl && oControl.setValueState) {
			oControl.setValueState("None");
		}
	}

	return BaseController.extend("hcm.fab.myleaverequest.controller.Creation", {
		oLocalModel: null,
		iLogCounter: 0,
		sCEEmployeeId: undefined,
		formatter: formatter,
		_messagesPopover: null,
		_notesBuffer: null,
		_previousAttachmentCollection: [],
		_previousInputHours: null,
		_previousStartTime: null,
		_previousEndTime: null,
		_multidayChanged: 0,
		_editMode: false,
		_oMessagePopover: null,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf hcm.fab.myleaverequest.view.Creation
		 */
		onInit: function() {
			var oOwnerComponent = this.getOwnerComponent();

			// Contains "instantiated" fragments
			this._oAdditionalFieldsControls = {};

			//
			// Setup a deferred object with a promise resolved when data about
			// absence type are received.
			//
			this._absenceTypeReceivedDeferred = utils.createDeferred();

			//
			// Used as a fallback during calculation of consumed working days.
			//
			this._lastBalanceTimeUnitName = this.getResourceBundle().getText("daysTxt");
			this._maxAttachmentsText = this.getResourceBundle().getText("txtMaxAttachmentsReached");

			var oRouter = oOwnerComponent.getRouter();
			oRouter.getRoute("creation").attachPatternMatched(this._onCreateRouteMatched, this);
			oRouter.getRoute("creationWithParams").attachPatternMatched(this._onCreateRouteMatched, this);
			oRouter.getRoute("edit").attachPatternMatched(this._onEditRouteMatched, this);

			this._oNotesModel = new JSONModel({
				NoteCollection: []
			});
			this.setModel(this._oNotesModel, "noteModel");

			this.oODataModel = oOwnerComponent.getModel();
			this.oLocalModel = oOwnerComponent.getModel("local");
			this.oLocalModel.setProperty("/create-busy", true);
			this.oErrorHandler = oOwnerComponent.getErrorHandler();

			this.initModel(this.oLocalModel);

			// Handle validation
			sap.ui.getCore().attachParseError(controlErrorHandler);
			sap.ui.getCore().attachValidationSuccess(controlNoErrorHandler);

			this.getView().byId("overlapCalendarInfoStrip").addStyleClass(Device.system.phone ? "sapUiTinyMargin" : "");
			this.getView().byId("usedWorkingTimeText").addStyleClass(Device.system.phone ? "sapUiTinyMarginEnd" : "sapUiTinyMarginBeginEnd");
			this.getView().byId("quotaText").addStyleClass(Device.system.phone ? "sapUiTinyMarginEnd" : "sapUiTinyMarginBeginEnd");
		},

		initModel: function(oModel) {
			this.setModelProperties(oModel, {
				"create-uploadPercentage": 0,
				"create-multiOrSingleDayRadioGroupIndex": 0, // bound TwoWay in view
				"create-BalanceAvailableQuantity": undefined,
				"create-TimeUnitName": undefined,
				"create-attachments": [],
				"create-attachmentsVisible": false,
				"create-attachmentsMandatory": false,
				"create-notes": "",
				"create-showDatePicker": false,
				"create-showRange": true,
				"create-MultipleApprovers": [],
				"create-addDelApprovers": false,
				"create-approverLevel": 0,
				"create-usedWorkingTime": this.getResourceBundle().getText("durationCalculationInitial"),
				"create-usedWorkingTimeUnit": undefined,
				"create-AdditionalFields": [],
				"create-MultipleApproverFlag": false,
				"create-readOnlyApprover": false,
				"create-showTimePicker": false,
				"create-showInputHours": false,
				"create-timePickerFilled": false,
				"create-inputHoursFilled": false,
				"create-viewTitle": null,
				"create-busy": false,
				"create-isApproverVisible": false,
				"create-isNoteVisible": false,
				"create-isQuotaCalculated": false,
				"create-singleAttachmentStripVisible": false,
				"create-maxAttachmentStripVisible": false,
				"create-duplicateAttachmentStripVisible": false,
				"calendar": {
					overlapNumber: 0,
					assignmentId: this.sCEEmployeeId
				}
			}, undefined, false);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/*
		 * Handler for the 'dataReceived' event on the Select control. It
		 * indicates that the control has items in the dropdown list to be
		 * rendered.
		 */
		onAbsenceTypeReceived: function(oEvent) {
			var aLoadedAbsenceTypes;

			aLoadedAbsenceTypes = oEvent.getParameter("data").results;
			this._absenceTypeReceivedDeferred.resolve(aLoadedAbsenceTypes);
		},

		onNumberChange: function(oEvent) {
			// If a number field is empty, an error occurs in the backend.
			// So this sets a missing number to "0".
			var oField = oEvent.getSource(),
				sNumber = oField.getValue();
			if (sNumber === "") {
				oField.setValue("0");
			}
		},

		/**
		 * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
		 * @memberOf hcm.fab.myleaverequest.view.Creation
		 */
		onExit: function() {
			this._cleanupUnsubmittedViewChanges(this._editMode);
			this._destroyAdditionalFields();
			this.oErrorHandler.clearErrors();
			if (this._oDialog) {
				this._oDialog.destroy();
			}
			if (this._oSearchHelperDialog) {
				this._oSearchHelperDialog.destroy();
			}
			if (this._oOverlapCalendar) {
				this._oOverlapCalendar.destroy();
			}
			if (this._overlapDialog) {
				this._overlapDialog.destroy();
			}
		},

		/*
		 * Update the OData model with the local model and submit the
		 * changes.
		 */
		onSendRequest: function() {
			var that = this,
				oViewModel = this.getViewModel(),
				oOriginalProperties = {};

			this.oErrorHandler.setShowErrors("manual");

			// Avoid updating the model 
			that.getView().unbindElement();

			var sPath = this.getView().getBindingContext().getPath();

			var fSetNoteProperty = function(sPropertyPath, oValue) {
				var oOldValue = oViewModel.getProperty(sPropertyPath);
				if (oValue === oOldValue) {
					return;
				}
				if (oValue && oValue.equals && oValue.equals(oOldValue)) {
					return;
				}
				oOriginalProperties[sPropertyPath] = oOldValue;
				oViewModel.setProperty(sPropertyPath, oValue);
			};
			this._copyAdditionalFieldsIntoModel(
				this.oLocalModel.getProperty("/create-AdditionalFields"),
				oViewModel,
				sPath
			);
			this._copyMultipleApproversIntoModel(
				oViewModel,
				sPath,
				this.oLocalModel.getProperty("/create-MultipleApprovers")
			);

			var notes = this.oLocalModel.getProperty("/create-notes");
			// Add note text if not empty
			if (notes) {
				fSetNoteProperty(sPath + "/Notes", notes);
			}
			//If note text did not changed keep the existing text (which means no update)
			else {
				fSetNoteProperty(sPath + "/Notes", this._notesBuffer);
			}

			if (this._getNumberOfAttachments() > I_MAX_ATTACHMENTS) {
				this.oErrorHandler.pushError(this._maxAttachmentsText);
				this.oErrorHandler.displayErrorPopup();
				this.oErrorHandler.setShowErrors("immediately");
				return;
			}

			if (this._editMode) {
				this._updateLeaveRequestWithDeletedAttachments(oViewModel, sPath);
			}
			//In case of create mode: set the time based values to initial (if probably touched in between
			//if (!this._editMode){
			if ((this.oLocalModel.getProperty("/create-multiOrSingleDayRadioGroupIndex") === null) ||
				(this.oLocalModel.getProperty("/create-multiOrSingleDayRadioGroupIndex") === 0)) {
				oViewModel.setProperty(sPath + "/PlannedWorkingHours", "0.0");
				oViewModel.setProperty(sPath + "/StartTime", "000000");
				oViewModel.setProperty(sPath + "/EndTime", "000000");
			}
			//}

			var fnError = function(oError) {
				this.oLocalModel.setProperty("/create-busy", false);
				this.oLocalModel.setProperty("/create-uploadPercentage", 0);

				// This addresses the current situation:
				//
				// 1. user enters some data in some of the fields
				// 2. submit error
				// 3. user deletes added fields
				// 4. submit success
				//
				Object.keys(oOriginalProperties).forEach(function(sInnerPath) {
					var oOriginalValue = oOriginalProperties[sInnerPath];

					oViewModel.setProperty(sInnerPath, oOriginalValue);
				});

				// show one or more error messages
				this.oErrorHandler.pushError(oError);
				this.oErrorHandler.displayErrorPopup();

				this.oErrorHandler.setShowErrors("immediately");
			};

			//
			// Handle submit
			if (this._editMode) {
				if (oViewModel.hasPendingChanges()) {
					this.oLocalModel.setProperty("/create-busy", true);
					this.submitLeaveRequest({
							viewModel: oViewModel,
							leavePath: sPath
						})
						.then(this._uploadAttachments.bind(this))
						//.then(this._updateLeaveRequestWithDeletedAttachments.bind(this))
						.then(this.showSuccessStatusMessage.bind(this))
						.then(function() {
							that.oErrorHandler.setShowErrors("immediately");
						})
						.catch(fnError.bind(this));
				}
			} else {
				this.oLocalModel.setProperty("/create-busy", true);
				this.submitLeaveRequest({
						viewModel: oViewModel,
						leavePath: sPath
					})
					.then(this._uploadAttachments.bind(this))
					.then(this.showSuccessStatusMessage.bind(this))
					.then(function() {
						that.oErrorHandler.setShowErrors("immediately");
					})
					.catch(fnError.bind(this));
			}
		},

		/**
		 * Event handler (attached declaratively) for the view cancel button. Asks the user confirmation to discard the changes. 
		 * @function
		 * @public
		 */
		onCancel: function() {
			this._confirmCancel();
		},

		/*
		 * Getter for the view model. The sModelName parameter is optional.
		 */
		getViewModel: function(sModelName) {
			return this.getView().getModel(sModelName);
		},

		submitLeaveRequest: function(oParams) {
			return new Promise(function(fnResolve, fnReject) {
				var iCountSuccess,
					oViewModel = oParams.viewModel,
					sNewLeavePath;
				//initial complete function
				iCountSuccess = 0;

				var fnBatchCompleted = function(oEvent) {
					var oBatchParams = oEvent.getParameters();
					var aRequests = oEvent.getParameters().requests;
					var oRequest;
					if (oBatchParams.success) {
						if (aRequests) {
							for (var i = 0; i < aRequests.length; i++) {
								oRequest = oEvent.getParameters().requests[i];
								if (oRequest.method === "POST" ||
									oRequest.method === "MERGE" ||
									oRequest.method === "PUT") {
									if (!oRequest.success) {
										fnReject();
										return false;
									} else {
										iCountSuccess++;
									}
								}
							}
						}
						if (iCountSuccess > 0) {
							fnResolve({
								viewModel: oViewModel,
								leavePath: sNewLeavePath
							});
						}
					}
					oViewModel.detachBatchRequestCompleted(fnBatchCompleted);
				};
				oViewModel.attachBatchRequestCompleted(fnBatchCompleted);
				oViewModel.submitChanges();
			});
		},

		updateLeaveRequestWithUploadedAttachments: function(oParams) {
			var that = this;
			return new Promise(function(fnResolve, fnReject) {
				var aFileUploadInfo = 0;
				if (oParams.uploadedFiles) {
					aFileUploadInfo = oParams.uploadedFiles;
				}
				if (aFileUploadInfo.length > 0) {
					Array.apply(null, {
						length: I_MAX_ATTACHMENTS
					}).forEach(function(oUndefined, iIdx) {
						var oFileUploadInfo = aFileUploadInfo[iIdx] || null;
					});
				}
				//count available attachments from model
				var countAvailableAttachments = 0;
				var oLeaveRequestToEdit = oParams.viewModel.getProperty(oParams.leavePath);
				Array.apply(null, {
					length: I_MAX_ATTACHMENTS
				}).map(function(oUndefined, iIdx) {
					return oLeaveRequestToEdit["Attachment" + (iIdx + 1)];
					//return oParams.viewModel.setProperty(oParams.leavePath + "/Attachment"
				}).filter(function(oAttachment) {
					if (oAttachment.FileName !== "") {
						countAvailableAttachments++;
					}
					return oAttachment.FileName !== "";
				});
				//Add information about removed files by delta check with upload collection
				var countSum = 0;
				var oUploadCollection = that.getView().byId("AttachmentCollection");
				var aAttachments = oUploadCollection.getItems();

				for (var i = 0; i <= (countAvailableAttachments - 1); i++) {
					for (var j = 0; j <= (aAttachments.length - 1); j++) {
						if (aAttachments[j].getProperty("fileName") ===
							oLeaveRequestToEdit["Attachment" + (i + 1)].FileName) {
							//isAvailable = true;       
							countSum++;
						}
					}
					if (countSum === 0) {
						oParams.viewModel.setProperty(oParams.leavePath + "/Attachment" + (i + 1) + "/AttachmentStatus", "D");
					}
					//isAvailable = false;
					countSum = 0;
				}
				//Upadate LeaveRequest with the new attachment data
				for (var i = 0; i <= (aFileUploadInfo.length - 1); i++) {
					oParams.viewModel.setProperty(oParams.leavePath + "/Attachment" + (i + 1 + countAvailableAttachments) + "/FileName",
						aFileUploadInfo[i].FileName);
				}
				setTimeout(function() {
					fnResolve({
						viewModel: oParams.viewModel,
						leavePath: oParams.leavePath,
						uploadedFiles: oParams.uploadedFiles
					});
				}, 0);
			});
		},

		_updateLeaveRequestWithDeletedAttachments: function(viewModel, leavePath) {
			//count available attachments from model
			var countAvailableAttachments = 0;
			var oLeaveRequestToEdit = viewModel.getProperty(leavePath);
			Array.apply(null, {
				length: I_MAX_ATTACHMENTS
			}).map(function(oUndefined, iIdx) {
				return oLeaveRequestToEdit["Attachment" + (iIdx + 1)];
				//return oParams.viewModel.setProperty(oParams.leavePath + "/Attachment"
			}).filter(function(oAttachment) {
				if (oAttachment.FileName !== "") {
					countAvailableAttachments++;
				}
				return oAttachment.FileName !== "";
			});
			//Add information about removed files by delta check with upload collection
			var countSum = 0;
			var oUploadCollection = this.getView().byId("AttachmentCollection");
			var aAttachments = oUploadCollection.getItems();

			for (var i = 0; i <= (countAvailableAttachments - 1); i++) {
				for (var j = 0; j <= (aAttachments.length - 1); j++) {
					if (aAttachments[j].getProperty("fileName") ===
						oLeaveRequestToEdit["Attachment" + (i + 1)].FileName) {
						//isAvailable = true;       
						countSum++;
					}
				}
				if (countSum === 0) {
					viewModel.setProperty(leavePath + "/Attachment" + (i + 1) + "/AttachmentStatus", "D");
				}
				//isAvailable = false;
				countSum = 0;
			}
			//Prepare LeaveRequest for new attachment data (if available)
			var aUploadAttachments = oUploadCollection.getItems();
			var firstItem = aUploadAttachments[0];
			var aAttachmentForUpload = oUploadCollection._aFileUploadersForPendingUpload;
			//Check whethe we have one new attachment already in the queue	
			if (aAttachmentForUpload.length >= 1) {
				if (firstItem) {
					if (firstItem._status !== "display") {
						viewModel.setProperty(leavePath + "/Attachment" + (countAvailableAttachments + 1) + "/FileName",
							aAttachmentForUpload[0].getProperty("value"));
					}
				}
			}
		},

		createLeaveRequestCollection: function() {
			return this.oODataModel.createEntry("/LeaveRequestSet", {
				properties: {
					StartDate: null,
					EndDate: null
				}
			});
		},

		onAdditionalFieldChanged: function(sAdditionalField) {
			this._additionalFieldsToSubmit[sAdditionalField] = true;
		},

		onAbsenceTypeChange: function(oEvent) {
			var oAbsenceTypeContext,
				oAbsenceTypeSelectedItem = this.getSelectedAbsenceTypeControl();

			var oLeaveRequestContextPath = this.getView().getBindingContext().getPath();

			if (oAbsenceTypeSelectedItem) {
				oAbsenceTypeContext = oAbsenceTypeSelectedItem.getBindingContext();
				this.updateViewModel(oAbsenceTypeContext.getObject(), {});

				var oAdditionalFieldsDefinitions = oAbsenceTypeContext.getProperty("toAdditionalFieldsDefinition") || [];

				var oAdditionalFields = {
					definition: oAdditionalFieldsDefinitions,
					values: this._getAdditionalFieldValues(
						oAdditionalFieldsDefinitions,
						this._getCurrentAdditionalFieldValues()
					)
				};
				// important: unbind local model from additional fields when
				// changing it. Otherwise bad things will happen with unbound
				// fields.
				this._destroyAdditionalFields();

				var aApprovers = this._getApprovers(
					oAbsenceTypeContext.getProperty("MultipleApproverFlag"), // single or multiple?
					{ // single
						Name: "",
						Pernr: ""
					},
					oAbsenceTypeContext.getProperty("toApprover") // multiple
				);
				this._updateLocalModel(
					aApprovers,
					oAdditionalFields,
					oAbsenceTypeContext.getObject(), {
						StartDate: this.getViewModel().getProperty(oLeaveRequestContextPath + "/StartDate"),
						EndDate: this.getViewModel().getProperty(oLeaveRequestContextPath + "/EndDate")
					}
				);
				this._fillAdditionalFields(
					this.oLocalModel,
					oAbsenceTypeContext.getProperty("AbsenceTypeCode"),
					this._getAdditionalFieldsContainer()
				);
				var bIsHourTrigger = false;
				this._updateCalcLeaveDays(bIsHourTrigger);
			}
		},

		onSingleMultiDayRadioSelected: function(oEvent) {
			var oCurrentEndDate,
				oCurrentStartDate,
				sCurrentLeaveRequestPath,
				oViewModel,
				bIsMulti,
				oRadioButtonControl;

			oRadioButtonControl = oEvent.getSource();
			bIsMulti = oRadioButtonControl.getSelectedIndex() === 0;

			// get current start/end date
			oViewModel = this.getViewModel();
			sCurrentLeaveRequestPath = this.getView().getBindingContext().getPath();
			oCurrentStartDate = oViewModel.getProperty(sCurrentLeaveRequestPath + "/StartDate");
			oCurrentEndDate = oViewModel.getProperty(sCurrentLeaveRequestPath + "/EndDate");

			if (oCurrentStartDate) {
				if (bIsMulti) {
					// when switching to multi from single, must ensure there is
					// also the end date...
					if (!oCurrentEndDate) {
						oViewModel.setProperty(sCurrentLeaveRequestPath + "/EndDate", oCurrentStartDate);
					}
				} else {
					// single date selected -> ensure end date is the same
					if (oCurrentEndDate) {
						oViewModel.setProperty(sCurrentLeaveRequestPath + "/EndDate", oCurrentStartDate);
					}
				}

				// must update the day count (single day is invisible)...
				this._updateCalcLeaveDays(false);
			}
		},

		onDateRangeChanged: function(oEvent) {
			var bValid = oEvent.getParameter("valid"),
				oDateRangeSelector = oEvent.getSource(),
				oStartDate = utils.dateToUTC(oEvent.getParameter("from")),
				sStartDatePath = this.getView().getBindingContext().getPath("StartDate"),
				oEndDate = utils.dateToUTC(oEvent.getParameter("to")),
				sEndDatePath = this.getView().getBindingContext().getPath("EndDate");

			if (bValid) {
				oDateRangeSelector.setValueState(sap.ui.core.ValueState.None);
				this.getViewModel().setProperty(sStartDatePath, oStartDate);
				this.getViewModel().setProperty(sEndDatePath, oEndDate);
				this._updateCalcLeaveDays(false);
			} else {
				oDateRangeSelector.setValueState(sap.ui.core.ValueState.Error);
			}
		},

		onInputHoursChange: function(oEvent) {
			if (oEvent.getParameter("value")) {
				this.oLocalModel.setProperty("/create-inputHoursFilled", true);
				//Set Start/End time to initial since it will be overruled
				var sStartTimePath = this.getView().getBindingContext().getPath("StartTime");
				this.getViewModel().setProperty(sStartTimePath, "");
				var sEndTimePath = this.getView().getBindingContext().getPath("EndTime");
				this.getViewModel().setProperty(sEndTimePath, "");

				var sPlannedWorkingHours = this.getView().getBindingContext().getPath("PlannedWorkingHours");
				this.getViewModel().setProperty(sPlannedWorkingHours, oEvent.getParameter("value"));
				//update information about used time with hour trigger true
				this._updateCalcLeaveDays(true);
			} else {
				this.oLocalModel.setProperty("/create-inputHoursFilled", false);
			}
		},

		onDatePickChanged: function(oEvent) {
			var oDate = DateFormat.getDateInstance().parse(oEvent.getParameter("newValue"), true);
			var sEndDatePath = this.getView().getBindingContext().getPath("EndDate");
			this.getViewModel().setProperty(sEndDatePath, oDate);
			this._updateCalcLeaveDays(false);
		},

		onDateChange: function(oEvent) {
			var bValid = oEvent.getParameter("valid"),
				oDatePicker = oEvent.getSource();
			if (bValid) {
				oDatePicker.setValueState(sap.ui.core.ValueState.None);
				this._updateCalcLeaveDays(false);
			} else {
				oDatePicker.setValueState(sap.ui.core.ValueState.Error);
			}
		},

		onTimeChange: function(oEvent) {
			if (oEvent.getParameter("newValue")) {
				this.oLocalModel.setProperty("/create-timePickerFilled", true);
			} else {
				this.oLocalModel.setProperty("/create-timePickerFilled", false);
			}
			//update information about used time
			this._updateCalcLeaveDays(false);
		},

		onApproverValueHelp: function(oEvent) {
			if (!this._oDialog) {
				var oDialogController = {
					handleSearch: this.handleApproverDialogSearch.bind(this),
					handleClose: this.handleApproverDialogClose.bind(this)
				};
				this._oDialog = sap.ui.xmlfragment(
					"hcm.fab.myleaverequest.view.fragments.ApproverDialog",
					oDialogController
				);
				jQuery.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), this.getView(), this._oDialog);
				this.getView().addDependent(this._oDialog);
			}
			// Recover the source control after the dialog is closed
			this._oDialog.data("initiator", oEvent.getSource());
			this._oDialog.open();
		},

		onRemoveApproverClicked: function(oEvent) {
			var aApprovers,
				oLocalModel;

			oLocalModel = this.getOwnerComponent().getModel("local");
			aApprovers = oLocalModel.getProperty("/create-MultipleApprovers").slice(0);
			aApprovers.pop(); // remove last

			oLocalModel.setProperty("/create-MultipleApprovers", aApprovers);
		},

		notesLiveChange: function(oEvent) {
			var sText = oEvent.getParameter("newValue");
			if (sText.length < 2) {
				return;
			}
			if (sText.indexOf("::") > -1) {
				var iCursorPosition = oEvent.getSource().getFocusDomRef().selectionStart;
				oEvent.getSource().setValue(sText.replace(/(:)+/g, "$1"));

				// restore cursor position
				oEvent.getSource().getFocusDomRef().setSelectionRange(iCursorPosition, iCursorPosition - 1);
			}
		},
		//Allow only one new attachment per save operation		
		onAttachmentChange: function(oEvent) {
			var bIsReplaced = false;
			var oUploadCollection = this.getView().byId("AttachmentCollection");
			var aAttachments = oUploadCollection.getItems();
			var firstItem = aAttachments[0];
			var sFileName = oEvent.getParameter("files")[0].name;

			this.oLocalModel.setProperty("/create-singleAttachmentStripVisible", false);
			this.oLocalModel.setProperty("/create-maxAttachmentStripVisible", false);
			this.oLocalModel.setProperty("/create-duplicateAttachmentStripVisible", false);

			//Validate whether attachment exist already
			aAttachments.forEach(function(oAttachment) {
				if (oAttachment.getProperty("fileName") === sFileName) {
					oUploadCollection.removeItem(oAttachment);
					this.oLocalModel.setProperty("/create-duplicateAttachmentStripVisible", true);
					bIsReplaced = true;
					return;
				}
			}.bind(this));
			if ((aAttachments.length >= I_MAX_ATTACHMENTS) && !bIsReplaced) {
				this.oLocalModel.setProperty("/create-maxAttachmentStripVisible", true);
				oUploadCollection.removeItem(firstItem);
				bIsReplaced = true;
			}
			if (!bIsReplaced) {
				var aAttachmentForUpload = oUploadCollection._aFileUploadersForPendingUpload;
				//Check whethe we have one new attachment already in the queue
				//If yes - replace the previous one and provide the description text		
				if (aAttachmentForUpload.length >= 1) {
					if (firstItem) {
						if (firstItem._status !== "display") {
							this.oLocalModel.setProperty("/create-singleAttachmentStripVisible", true);
							oUploadCollection.removeItem(firstItem);
						}
					}
				}
			}
		},

		onBeforeUploadStarts: function(oEvent) {
			var oEventParameters = oEvent.getParameters();
			// Header Slug
			var oCustomerHeaderSlug = new UploadCollectionParameter({
				name: "slug",
				value: oEvent.getParameter("fileName")
			});
			oEventParameters.addHeaderParameter(oCustomerHeaderSlug);

			var oCustomerHeaderToken = new UploadCollectionParameter({
				name: "x-csrf-token",
				value: this.getView().getModel().getSecurityToken()
			});
			oEventParameters.addHeaderParameter(oCustomerHeaderToken);
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

		handleApproverDialogSearch: function(oEvent) {
			var sSearchText = oEvent.getParameter("value"),
				oItemTemplate = new StandardListItem({
					title: "{ApproverEmployeeName}",
					description: "{ApproverEmployeeID}"
				});

			oEvent.getSource().bindAggregation("items", {
				path: "/SearchApproverSet",
				parameters: {
					custom: sSearchText ? {
						search: encodeURIComponent(sSearchText)
					} : {},
					countMode: sap.ui.model.odata.CountMode.Inline
				},
				template: oItemTemplate
			});
		},

		/**
		 * Handles closed approvers dialog.
		 *
		 * An approver is selected from the multiple approver collection, via
		 * the F4 help. The task of this method is to render the selected
		 * approver in the input field by updating the local model with the
		 * newly selected values.
		 *
		 * @param {object} oEvent
		 *   Event triggered when the approver dialog is closed.
		 */
		handleApproverDialogClose: function(oEvent) {
			var aApproversUpdated,
				iNewApproverIdx,
				aApprovers,
				oDialogInitiatorControl,
				sApproverEmployeeName,
				sApproverEmployeeId,
				sApproverPath,
				aContexts;

			aContexts = oEvent.getParameter("selectedContexts");
			if (aContexts.length) {
				sApproverPath = aContexts[0].sPath;

				sApproverEmployeeId = this.getViewModel().getProperty(sApproverPath + "/ApproverEmployeeID");
				sApproverEmployeeName = this.getViewModel().getProperty(sApproverPath + "/ApproverEmployeeName");

				oDialogInitiatorControl = oEvent.getSource().data("initiator");

				aApprovers = this.oLocalModel.getProperty("/create-MultipleApprovers");
				iNewApproverIdx = formatter.getSuperControlIndex(oDialogInitiatorControl);

				// must copy the array to trigger update on setProperty
				aApproversUpdated = aApprovers.slice(0);

				aApproversUpdated[iNewApproverIdx] = {
					Name: sApproverEmployeeName,
					Pernr: sApproverEmployeeId,
					Seqnr: "0" + iNewApproverIdx + 1,
					DefaultFlag: ""
				};
				this.oLocalModel.setProperty("/create-MultipleApprovers", aApproversUpdated);
			}
		},

		handleSearchHelperDialogSearch: function(oEvent) {
			var oBinding,
				sSearchText,
				oDialogInitiatorControl;

			oDialogInitiatorControl = oEvent.getSource().data("initiator");
			sSearchText = oEvent.getParameter("value");

			// Create filter fields as specified in the view
			var oFilter = new Filter({
				filters: oDialogInitiatorControl.data("helperCollectionFilterFields")
					.split(",")
					.map(function(sFilterField) {
						return new Filter(
							sFilterField,
							sap.ui.model.FilterOperator.Contains,
							sSearchText
						);
					}),
				and: false // or logic
			});

			oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleSearchHelperDialogClose: function(oEvent) {
			var sSelectedItemValue,
				sFieldToSave,
				oInitiatorControl,
				oSelectedItem = (oEvent.getParameter("selectedContexts") || [])[0];

			if (!oSelectedItem) {
				return;
			}
			oInitiatorControl = oEvent.getSource().data("initiator");
			sFieldToSave = oInitiatorControl.data("helperFieldToValueAfterSelection");

			sSelectedItemValue = oSelectedItem.getProperty(
				oSelectedItem.getPath() + "/" + sFieldToSave
			);
			// Save value back into original model
			var sCurrentAdditionalFieldPath = oInitiatorControl.getBindingContext("local").getPath();
			this.oLocalModel.setProperty(
				sCurrentAdditionalFieldPath + "/value",
				sSelectedItemValue
			);
		},

		onSearchHelperRequest: function(oEvent) {
			var that = this;
			var oSourceControl = oEvent.getSource();
			var sInitialSearchText = oSourceControl.getValue();

			if (!this._oSearchHelperDialog) {
				var oDialogController = {
					handleSearch: this.handleSearchHelperDialogSearch.bind(this),
					handleClose: this.handleSearchHelperDialogClose.bind(this)
				};
				this._oSearchHelperDialog = sap.ui.xmlfragment(
					"hcm.fab.myleaverequest.view.fragments.SearchHelperDialog",
					oDialogController
				);
			}
			// TODO: nothing happens currently if the data take a while to be
			//       fetched... show busy indicator?

			this.getSearchHelperDialogModel(
				oSourceControl.data("helperTitleText"),
				oSourceControl.data("helperNoDataFoundText"),
				oSourceControl.data("helperCollection"),
				oSourceControl.data("helperCollectionTitleField"),
				oSourceControl.data("helperCollectionDescriptionField")
			).then(function(oModel) {
				that._oSearchHelperDialog.setModel(oModel);
				that._oSearchHelperDialog.data("initiator", oSourceControl);

				var oInitialSearchEvent = new Event("initSearch", that._oSearchHelperDialog, {
					value: sInitialSearchText
				});
				that.handleSearchHelperDialogSearch(oInitialSearchEvent);
				that._oSearchHelperDialog.open(sInitialSearchText);
			}, function(oError) {
				jQuery.sap.log.error(
					"Error occurred while loading value help",
					oError
				);
			});
		},

		onNavBack: function() {
			//check for model changes and ask for cancel confirmation
			this._confirmCancel();
		},

		onAddApproverClicked: function(oEvent) {
			var aApproversPlusOne,
				aApprovers,
				oLocalModel = this.getModel("local");

			aApprovers = oLocalModel.getProperty("/create-MultipleApprovers");

			aApproversPlusOne = aApprovers.slice(0);
			aApproversPlusOne.push({});

			oLocalModel.setProperty("/create-MultipleApprovers", aApproversPlusOne);
		},

		showSuccessStatusMessage: function(oParams) {
			var that = this;
			var sTitle = this.getModel("local").getProperty("/create-viewTitle");
			var sMessage = this.getResourceBundle().getText("createdSuccessfully");

			this.oLocalModel.setProperty("/create-busy", false);

			// Show toast
			MessageBox.show(
				sMessage, {
					icon: MessageBox.Icon.INFORMATION,
					title: sTitle,
					actions: [MessageBox.Action.OK],
					onClose: function() {
						// send event to refresh the overview page
						sap.ui.getCore().getEventBus().publish("hcm.fab.myleaverequest", "invalidateoverview", "refresh");
						utils.navTo.call(that, "overview");
					}
				}
			);
			return Promise.resolve(oParams);
		},

		getSelectedAbsenceTypeControl: function() {
			return this.getView().byId("absenceType").getSelectedItem();
		},

		getSearchHelperDialogModel: function(sDialogTitle, sDialogNoResultText, sCollectionName, sTitleField, sDescriptionField) {
			var that = this;
			return new Promise(function(fnResolve, fnReject) {
				// retrieve data from model
				that.getViewModel().read("/" + sCollectionName, {
					success: function(oCollection, oRequest) {
						if (!oCollection.hasOwnProperty("results")) {
							fnReject("Cannot find 'results' member in the " + sCollectionName + " collection");
							return;
						}
						var oFragmentModel = {
							DialogTitle: sDialogTitle,
							NoDataText: sDialogNoResultText,
							Collection: []
						};
						oFragmentModel.Collection = oCollection.results.map(function(oCollectionItem) {
							// fields for filtering
							var oCollectionItemClone = jQuery.extend({}, oCollectionItem, true);

							// fields for rendering 
							oCollectionItemClone.Title = oCollectionItem[sTitleField];
							oCollectionItemClone.Description = oCollectionItem[sDescriptionField];

							return oCollectionItemClone;
						});

						fnResolve(new JSONModel(oFragmentModel));
					},
					error: function(oError) {
						fnReject(oError);
					}
				});
			});
		},

		/**
		 * Sets a group of properties into the given model.
		 *
		 * @param {object} oModel
		 *   A model object
		 * @param {object} oProperties
		 *   An object indicating properties to set in the model and their
		 *   respective values.
		 * @param {string} [sPathPrefix]
		 *   The prefix for the model path. If given, the properties are stored
		 *   under this path. Otherwise they are stored at the model root level
		 *   "/".
		 * @param {boolean} [bUpdateView]
		 *   Whether the view should be updated once all properties have been
		 *   set. Defaults to true.
		 */
		setModelProperties: function(oModel, oProperties, sPathPrefix, bUpdateView) {
			if (typeof bUpdateView === "undefined") {
				bUpdateView = true;
			}
			var aProperties = Object.keys(oProperties);
			var iPropertyCount = aProperties.length;
			aProperties.forEach(function(sProperty, iIdx) {
				var bAsyncModelUpdate = true;
				var sPropertyPath = (sPathPrefix || "") + "/" + sProperty;

				// force model update when the last property is set
				if (iIdx === iPropertyCount - 1 && bUpdateView) {
					bAsyncModelUpdate = false;
				}
				oModel.setProperty(sPropertyPath, oProperties[sProperty], bAsyncModelUpdate /* don't update view */ );
			});
		},

		updateViewModel: function(oAbsenceTypeData, oRouteArgs) {
			var sPath = this.getView().getBindingContext().getPath();
			var oNewProperties = {
				"EmployeeID": oAbsenceTypeData.EmployeeID,
				"AbsenceTypeName": oAbsenceTypeData.AbsenceTypeName
			};

			var sAbsenceTypeCode = oRouteArgs.absenceType && oRouteArgs.absenceType !== "default" ? oRouteArgs.absenceType : oAbsenceTypeData
				.AbsenceTypeCode;
			oNewProperties.AbsenceTypeCode = sAbsenceTypeCode;

			var oDateFrom = oRouteArgs.dateFrom ? new Date(parseInt(oRouteArgs.dateFrom, 10)) : null;
			if (oDateFrom) {
				oNewProperties.StartDate = oDateFrom;
			}

			var oDateTo = oRouteArgs.dateTo ? new Date(parseInt(oRouteArgs.dateTo, 10)) : null;
			if (oDateTo) {
				oNewProperties.EndDate = oDateTo;
			}

			var oViewModel = this.getViewModel();
			this.setModelProperties(
				oViewModel,
				oNewProperties,
				sPath,
				false /* update view */
			);
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Navigates back in the browser history, if the entry was created by this app.
		 * If not, it navigates to the Details page
		 * @private
		 */
		_navBack: function() {
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

		_confirmCancel: function() {
			var oComponent = this.getOwnerComponent(),
				oModel = this.getViewModel();
			// check if the model has been changed
			if (oModel.hasPendingChanges()) {
				// get user confirmation first			
				MessageBox.confirm(this.getResourceBundle().getText("cancelPopover"), {
					styleClass: oComponent.getContentDensityClass(),
					initialFocus: MessageBox.Action.CANCEL,
					onClose: function(oAction) {
						if (oAction === MessageBox.Action.OK) {
							this._cleanupUnsubmittedViewChanges(this._editMode);
							this._navBack();
						}
					}.bind(this)
				});
			} else {
				// cancel without confirmation
				this._navBack();
			}
		},

		/*
		 * This is the handler called when the route is matched. This handler
		 * is called before any events are triggered by the view (e.g.,
		 * onAbsenceTypeReceived).
		 */
		_onCreateRouteMatched: function(oEvent) {
			var that = this,
				oRouteArgs;

			this.oErrorHandler.setShowErrors("immediately");
			this.oErrorHandler.clearErrors();
			this._editMode = false;
			this._notesBuffer = "";

			//
			// Actions that don't depend on all the absence type being
			// retrieved below...
			//
			this._destroyAdditionalFields();
			this._cleanupAttachmentCollection();
			this._cleanupUnsubmittedViewChanges(false /* bEditMode */ );

			this.oLocalModel.setProperty("/create-viewTitle", this.getResourceBundle().getText("createViewTitle"));
			oRouteArgs = oEvent.getParameter("arguments");

			var oAssignmentPromise = this.getOwnerComponent().getAssignmentId();
			Promise.all([
				this.oODataModel.metadataLoaded(),
				oAssignmentPromise
			]).then(function(aPromiseResults) {
				// did the assignment change?
				if (this.sCEEmployeeId !== aPromiseResults[1]) {
					this._absenceTypeReceivedDeferred = utils.createDeferred();

					// update binding
					this.sCEEmployeeId = aPromiseResults[1];
					var filters = [];
					filters.push(new Filter("EmployeeID", sap.ui.model.FilterOperator.EQ, this.sCEEmployeeId));
					this._oSelectionItemTemplate = this.getView().byId("selectionTypeItem");
					this.oLocalModel.setProperty("/create-busy", true);
					var oAbsenceTypeControl = this.getView().byId("absenceType");
					oAbsenceTypeControl.bindItems({
						path: "/AbsenceTypeSet",
						template: this._oSelectionItemTemplate,
						filters: filters,
						parameters: {
							expand: "toAdditionalFieldsDefinition,toApprover"
						},
						events: {
							dataReceived: this.onAbsenceTypeReceived.bind(this)
						}
					});
				}

				// Initialize overlap calendar
				this._initOverlapCalendar();

				this._absenceTypeReceivedDeferred.promise.then(function(oAbsenceTypeResult) {
					var aAbsenceTypesInDropdown = oAbsenceTypeResult;

					var oViewBindingContext,
						sInitialAbsenceTypeCode;

					that.oLocalModel.setProperty("/create-busy", false);

					// Create a new entry and prepare to edit it...
					oViewBindingContext = that.createLeaveRequestCollection();
					that.getView().setBindingContext(oViewBindingContext);

					sInitialAbsenceTypeCode = aAbsenceTypesInDropdown[0].AbsenceTypeCode;
					if (oRouteArgs.absenceType && oRouteArgs.absenceType && oRouteArgs.absenceType !== "default") {
						sInitialAbsenceTypeCode = oRouteArgs.absenceType;
					}

					var oSelectedAbsenceType = aAbsenceTypesInDropdown.filter(function(oAbsenceType) {
						return oAbsenceType.AbsenceTypeCode === sInitialAbsenceTypeCode;
					})[0];

					that.updateViewModel(oSelectedAbsenceType, oRouteArgs);

					var oSelectedAbsenceTypeControl = that.getSelectedAbsenceTypeControl();
					var oAbsenceTypeData = jQuery.extend(true, {}, oSelectedAbsenceType);
					var oAbsenceTypeControlContext = oSelectedAbsenceTypeControl.getBindingContext();
					var oAdditionalFieldsDefinitions = oAbsenceTypeControlContext.getProperty("toAdditionalFieldsDefinition") || [];

					var oAdditionalFields = {
						definition: oAdditionalFieldsDefinitions,
						values: that._getAdditionalFieldValues(
							oAdditionalFieldsDefinitions, {} /* non-default values to display */
						)
					};

					var aApprovers = that._getApprovers(
						oAbsenceTypeControlContext.getProperty("IsMultiLevelApproval"), // single or multiple?
						{ // single
							Name: "",
							Pernr: ""
								//Name: oAbsenceTypeControlContext.getProperty("ApproverName"),
								//Pernr: oAbsenceTypeControlContext.getProperty("ApproverPernr")
						},
						oAbsenceTypeControlContext.getProperty("toApprover") // multiple
					);

					that._updateLocalModel(
						aApprovers,
						oAdditionalFields,
						oAbsenceTypeData, {
							StartDate: that.getViewModel().getProperty(oViewBindingContext.getPath() + "/StartDate"),
							EndDate: that.getViewModel().getProperty(oViewBindingContext.getPath() + "/EndDate")
						}
					);

					that._fillAdditionalFields(
						that.oLocalModel,
						oAbsenceTypeData.AbsenceTypeCode,
						that._getAdditionalFieldsContainer()
					);
					// //calculate potentially used time
					that._updateCalcLeaveDays(false);
					// Done
					that.oLocalModel.setProperty("/create-busy", false);
				});
			}.bind(this));
		},

		_onEditRouteMatched: function(oEvent) {
			var that = this,
				oRouteArgs = oEvent.getParameter("arguments"),
				sLeaveRequestId = "/" + oRouteArgs.leavePath;

			this._cleanUpAttachmentCollectionIfCreated();

			this.oErrorHandler.setShowErrors("immediately");
			this.oErrorHandler.clearErrors();
			this._destroyAdditionalFields();

			this._notesBuffer = this.getViewModel().getProperty(sLeaveRequestId + "/Notes");

			this.oLocalModel.setProperty("/create-viewTitle", this.getResourceBundle().getText("editViewTitle"));

			this._editMode = true;
			this._cleanupUnsubmittedViewChanges(true /* bEditMode */ );

			var oAssignmentPromise = this.getOwnerComponent().getAssignmentId();
			Promise.all([
				this.oODataModel.metadataLoaded(),
				oAssignmentPromise
			]).then(function(aPromiseResults) {
				// did the assignment change?
				if (this.sCEEmployeeId !== aPromiseResults[1]) {
					this._absenceTypeReceivedDeferred = utils.createDeferred();

					// update binding
					this.sCEEmployeeId = aPromiseResults[1];
					var filters = [];
					filters.push(new Filter("EmployeeID", sap.ui.model.FilterOperator.EQ, this.sCEEmployeeId));
					this._oSelectionItemTemplate = this.getView().byId("selectionTypeItem");
					var oAbsenceTypeControl = this.getView().byId("absenceType");
					oAbsenceTypeControl.bindItems({
						path: "/AbsenceTypeSet",
						template: this._oSelectionItemTemplate,
						filters: filters,
						parameters: {
							expand: "toAdditionalFieldsDefinition,toApprover"
						}
					});
					oAbsenceTypeControl.getBinding("items").attachDataReceived(this.onAbsenceTypeReceived.bind(this));
				}

				// Initialize overlap calendar
				this._initOverlapCalendar();

				var oLeaveRequestToEdit = this.getViewModel().getProperty(sLeaveRequestId);
				if (oLeaveRequestToEdit) {
					// Wait for data in the dropdown to be populated
					this._absenceTypeReceivedDeferred.promise.then(function() {
						// Update view model (including selected Absence Type)
						var oLeaveRequestContext = new sap.ui.model.Context(that.getViewModel(), sLeaveRequestId);
						that.getView().unbindElement();
						that.getView().setBindingContext(oLeaveRequestContext);

						var oSelectedAbsenceTypeControl = that.getSelectedAbsenceTypeControl();

						//transform notes (temporary solution!)
						var sNoteString = oLeaveRequestToEdit.Notes,
							aNotes = that.formatter.formatNotes(sNoteString);
						that._oNotesModel.setProperty("/NoteCollection", aNotes);

						// The oLeaveRequestToEdit is an instance of
						// LeaveRequestCollection. There are some information
						// that we still need to borrow from the current request
						// type before updating the local model.
						var oAbsenceTypeContext = oSelectedAbsenceTypeControl.getBindingContext();
						var oSelectedAbsenceType = oAbsenceTypeContext.getObject();
						oLeaveRequestToEdit.ApproverLevel = oSelectedAbsenceType.ApproverLevel;

						var oAdditionalFieldsDefinitions = oAbsenceTypeContext.getProperty("toAdditionalFieldsDefinition");

						var oAdditionalFields = {
							definition: oAdditionalFieldsDefinitions,
							values: that._getAdditionalFieldValues(
								oAdditionalFieldsDefinitions,
								oLeaveRequestToEdit.AdditionalFields /* display these values */
							)
						};

						var aApprovers = that._getEditApprovers(
							oAbsenceTypeContext.getProperty("IsMultiLevelApproval"), // single or multiple?
							{ // single
								Name: oLeaveRequestContext.getProperty("ApproverLvl1/Name"),
								Pernr: oLeaveRequestContext.getProperty("ApproverLvl1/Pernr"),
								Seqnr: oLeaveRequestContext.getProperty("ApproverLvl1/Seqnr"),
								DefaultFlag: oLeaveRequestContext.getProperty("ApproverLvl1/DefaultFlag")
							},
							Array.apply(null, {
								length: I_MAX_APPROVERS
							}).map(function(oUndefined, iIdx) {
								return oLeaveRequestContext.getProperty("ApproverLvl" + (iIdx + 1));
							}).filter(function(oApprover) {
								return oApprover && !!(oApprover.Name);
							})
						);

						that._updateLocalModel(
							aApprovers,
							oAdditionalFields,
							oAbsenceTypeContext.getObject(), {
								StartDate: oLeaveRequestToEdit.StartDate,
								EndDate: oLeaveRequestToEdit.EndDate
							}
						);

						that._fillAdditionalFields(
							that.oLocalModel,
							oSelectedAbsenceType.AbsenceTypeCode,
							that._getAdditionalFieldsContainer()
						);

						//Update attachment list with the external available URL 
						var iCountAttachment = 0;
						var sServiceUrl = that.oODataModel.sServiceUrl;
						that.oLocalModel.setProperty("/create-attachments",
							Array.apply(null, {
								length: I_MAX_ATTACHMENTS
							}).map(function(oUndefined, iIdx) {
								return oLeaveRequestToEdit["Attachment" + (iIdx + 1)];
							}).filter(function(oAttachment) {
								iCountAttachment++;
								if (oAttachment.FileName !== "") {
									var sFileAttachmentSetPath = "/FileAttachmentSet(EmployeeID='" + oLeaveRequestToEdit.EmployeeID +
										"',LeaveRequestId='" + oLeaveRequestToEdit.RequestID +
										"',FileName='" + (oLeaveRequestToEdit["Attachment" + (iCountAttachment)].FileName) +
										"',ArchivDocId='" + (oLeaveRequestToEdit["Attachment" + (iCountAttachment)].ArchivDocId) +
										"')/$value";

									oAttachment.FileUrl = sServiceUrl + sFileAttachmentSetPath;
								}
								return oAttachment.FileName !== "";
							})
						);
						var oUploadCollection = that.getView().byId("AttachmentCollection");
						that._previousAttachmentCollection = oUploadCollection.getItems();
						that._updateCalcLeaveDays(false);
						that.oLocalModel.setProperty("/create-busy", false);
					});
				} else {
					/*
					 * Currently we cannot navigate directly to an edit page
					 * because ids of a leave request can change when the app is
					 * first opened. Therefore we must navigate to the overview
					 * page in these cases.
					 */
					utils.navTo.call(this, "overview", true /* bReplace */ );
				}
			}.bind(this));
		},

		_destroyAdditionalFields: function() {
			var that = this;

			Object.keys(this._oAdditionalFieldsControls).forEach(function(sFieldName) {
				var aControls = that._oAdditionalFieldsControls[sFieldName];
				aControls.forEach(function(oControl, iIndex) {
					oControl.destroy();
					if (iIndex > 0) {
						delete that._oAdditionalFieldsControls[sFieldName];
					}
				});
			});
		},

		_getAdditionalFieldsContainer: function() {
			return this.getView().byId("additionalFieldsSimpleForm");
		},

		_getAdditionalFieldFragmentName: function(oAdditionalField) {
			if (oAdditionalField.Type_Kind === "T") {
				return "AdditionalFieldTimePicker";
			}
			if (oAdditionalField.Type_Kind === "D") {
				return "AdditionalFieldDatePicker";
			}
			if (formatter.isAdditionalFieldCheckbox(oAdditionalField.Type_Kind, oAdditionalField.Length)) {
				return "AdditionalFieldCheckbox";
			}
			if (formatter.isAdditionalFieldInputDecimal(oAdditionalField.Type_Kind)) {
				return null;
			}
			if (formatter.isAdditionalFieldInputInteger(oAdditionalField.Type_Kind)) {
				return "AdditionalFieldInputInteger";
			}
			if (formatter.isAdditionalFieldInput(oAdditionalField.Type_Kind, oAdditionalField.Length) && oAdditionalField.HasF4 === true) {
				return "AdditionalFieldSearchHelperInput";
			}
			return "AdditionalFieldInput";
		},

		_callCalcLeaveDaysFunctionImport: function(oParams) {
			var that = this;

			return new Promise(function(fnResolve, fnReject) {
				that.oODataModel.callFunction("/CalculateLeaveSpan", {
					method: "GET",
					urlParameters: oParams,
					success: function(oResult) {
						fnResolve(oResult);
					},
					error: function(oError) {
						fnReject(oError);
					}
				});
			});
		},

		_callAvailableQuotaFunctionImport: function(oParams) {
			var that = this;

			return new Promise(function(fnResolve, fnReject) {
				that.oODataModel.callFunction("/CalculateQuotaAvailable", {
					method: "GET",
					urlParameters: oParams,
					success: function(oResult) {
						fnResolve(oResult);
					},
					error: function(oError) {
						fnReject(oError);
					}
				});
			});
		},

		_cleanupAttachmentCollection: function() {
			var oAttachmentControl = this.getView().byId("AttachmentCollection");
			if (oAttachmentControl) {
				oAttachmentControl.removeAllItems();
				//oAttachmentControl.removeAllParameters();
			}
		},

		//Clean Up Attachment Collection for the following case:
		//1. Create New LeaveRequest with Attachment
		//2. Go (via Edit) to the same LeaveRequest Again
		//In this case the previously created attachment would
		//be available in the none-uploaded state 
		//-> So remove it before preparing the attachment list again
		_cleanUpAttachmentCollectionIfCreated: function() {
			this._previousAttachmentCollection.forEach(function(oAttachment) {
				oAttachment.destroy();
			});
			this._previousAttachmentCollection = [];
			var oAttachmentControl = this.getView().byId("AttachmentCollection");
			//Delete Pending Upload List since Upload Collection cannot handle it
			var aPendingUpload = oAttachmentControl._aFileUploadersForPendingUpload;
			aPendingUpload.forEach(function(oAttachment) {
				oAttachment.destroy();
			});
			oAttachmentControl._aFileUploadersForPendingUpload = [];
		},

		/**
		 * Cleans up any unsubmitted change to the view model.
		 *
		 * The following scenario can occur. User creates a new leave request.
		 * Starts filling it in. Then he/she clicks browser back button without
		 * submitting the leave request. If this cleanup is not made, a new
		 * binding path will be created and bound to the view model, and when
		 * submitting, also the previous (unfinished) request is submitted.
		 *
		 * This method is safe to call if there is no binding path.
		 *
		 * @param {boolean} bEditMode
		 *   Whether the leave request is being edited
		 */
		_cleanupUnsubmittedViewChanges: function(bEditMode) {
			var oContext = this.getView().getBindingContext();
			if (!oContext) {
				return;
			}

			var sBindingPath = oContext.getPath();

			if (bEditMode) {
				if (this.oODataModel.hasPendingChanges()) {
					this.oODataModel.resetChanges([sBindingPath]);
					this.getView().setBindingContext(null);
				}
			} else {
				if (oContext) {
					this.oODataModel.deleteCreatedEntry(oContext);
					this.getView().setBindingContext(null);
				}
			}
		},

		//
		// Attachments ----------
		//
		_getAttachmentsUploadUrl: function() {
			return [
				this.getViewModel().sServiceUrl,
				this.getView().getBindingContext().getPath(),
				"/toAttachments"
			].join("");
		},

		_getNumberOfAttachments: function() {
			var oUploadCollection = this.byId("AttachmentCollection");
			var aAttachments = oUploadCollection.getItems();

			return aAttachments.length;
		},

		_updateUploadUrls: function(aAttachments, sUploadUrl) {
			var that = this,
				sFileUploadId,
				oFileUpload;

			var iUrlSetCount = 0;

			aAttachments.forEach(function(oAttachment) {
				sFileUploadId = oAttachment.getFileUploader();

				if (!sFileUploadId) {
					// skip files that were there (in edit mode)
					return;
				}
				oFileUpload = that.getView().byId(sFileUploadId);
				oFileUpload.setUploadUrl(sUploadUrl);
				that._previousAttachmentCollection[that._previousAttachmentCollection.length] = oAttachment;
				iUrlSetCount++;
			});

			return iUrlSetCount;
		},

		//Update the calculation of potentially used days on basis of the UI input
		_updateCalcLeaveDays: function(bIsHourTriggered) {
			var that = this;
			var sStartTime = null;
			var sEndTime = null;
			var sInputHours = null;
			var decHoursForFunction = null;
			var oViewModel = this.getViewModel();
			var oViewBindingContext = this.getView().getBindingContext();

			var oDateFormat = DateFormat.getDateTimeInstance({
				pattern: "yyyyMMdd"
			});

			var sCurrentLeaveRequestPath = oViewBindingContext.getPath();
			var oRangeStartDate = oViewModel.getProperty(sCurrentLeaveRequestPath + "/StartDate");
			var oRangeEndDate = oViewModel.getProperty(sCurrentLeaveRequestPath + "/EndDate");

			if (!oRangeStartDate || !formatter.isGroupEnabled(oRangeStartDate, this.getSelectedAbsenceTypeControl().getBindingContext().getObject()
					.AbsenceTypeCode)) {
				return;
			}

			var sCalculatingText = this.getResourceBundle().getText("durationCalculation");
			this.oLocalModel.setProperty("/create-usedWorkingTime", sCalculatingText);
			this.oLocalModel.setProperty("/create-usedWorkingTimeUnit", null);

			var sDateStartFormatted = oDateFormat.format(oRangeStartDate);
			var sDateEndFormatted = oDateFormat.format(oRangeEndDate);

			//use Start/End-Time with default value if multidays are available
			if (that.oLocalModel.getProperty("/create-multiOrSingleDayRadioGroupIndex") === 0) {
				sStartTime = "";
				sEndTime = "";
			} else {
				//use Start/End-Time from the available model or (if initial) go with default value
				sStartTime = oViewModel.getProperty(sCurrentLeaveRequestPath + "/StartTime");
				if (!sStartTime) {
					sStartTime = "";
				}
				sEndTime = oViewModel.getProperty(sCurrentLeaveRequestPath + "/EndTime");
				if (!sEndTime) {
					sEndTime = "";
				}
			}
			var sLeaveKey = oViewModel.getProperty(sCurrentLeaveRequestPath + "/LeaveKey");
			if (!this._editMode) {
				sLeaveKey = "";
			}

			var sRequestID = oViewModel.getProperty(sCurrentLeaveRequestPath + "/RequestID");
			if (!this._editMode) {
				sRequestID = "";
			}

			if (that.oLocalModel.getProperty("/create-multiOrSingleDayRadioGroupIndex") === 0) {
				sInputHours = "0.0";
			} else {
				sInputHours = oViewModel.getProperty(sCurrentLeaveRequestPath + "/PlannedWorkingHours");
				if (!sInputHours || sInputHours <= 0) {
					sInputHours = "0.0";
				}

				var oNumberFormat = NumberFormat.getFloatInstance({
					parseAsString: true
				});
				decHoursForFunction = oNumberFormat.parse(sInputHours);
				if (bIsHourTriggered) {
					oViewModel.setProperty(sCurrentLeaveRequestPath + "/PlannedWorkingHours", decHoursForFunction);
				}
				if (!decHoursForFunction) {
					decHoursForFunction = "";
				}
			}
			//Check whether hours are within one calendar day 
			if (!decHoursForFunction || decHoursForFunction <= 0 || decHoursForFunction > 24) {
				decHoursForFunction = "0.0";
			}

			var sStatusId = oViewModel.getProperty(sCurrentLeaveRequestPath + "/StatusID");
			if (!sStatusId) {
				sStatusId = "";
			}

			this._callCalcLeaveDaysFunctionImport({
				AbsenceTypeCode: this.getSelectedAbsenceTypeControl().getBindingContext().getObject().AbsenceTypeCode,
				EmployeeID: this.getSelectedAbsenceTypeControl().getBindingContext().getObject().EmployeeID,
				InfoType: this.getSelectedAbsenceTypeControl().getBindingContext().getObject().InfoType,
				StartDate: sDateStartFormatted,
				EndDate: sDateEndFormatted,
				BeginTime: sStartTime,
				EndTime: sEndTime,
				RequestID: sRequestID,
				InputHours: decHoursForFunction,
				StatusID: sStatusId,
				LeaveKey: sLeaveKey
			}).then(function(oSuccess) {
				var sTimeUnitName,
					fDuration;

				if (!oSuccess) {
					that.oLocalModel.setProperty("/create-usedWorkingTime", null);
					that.oLocalModel.setProperty("/create-usedWorkingTimeUnit", null);
					return;
				}

				// how long...
				fDuration = parseFloat(oSuccess.CalculateLeaveSpan.QuotaUsed);

				// ...days/hours
				sTimeUnitName = that._lastBalanceTimeUnitName; // fallback
				if (oSuccess.CalculateLeaveSpan.TimeUnitText) {
					sTimeUnitName = oSuccess.CalculateLeaveSpan.TimeUnitText; // this is preferred
				}

				that.oLocalModel.setProperty("/create-usedWorkingTime", fDuration);
				that.oLocalModel.setProperty("/create-usedWorkingTimeUnit", sTimeUnitName);

				//Process hour based logic for start/end/hours value only in case of single day seletion
				if (that.oLocalModel.getProperty("/create-multiOrSingleDayRadioGroupIndex") === 1) {
					// Manage setting of start/end time in case of input hours are entered
					if (bIsHourTriggered === true) {
						//Proceed only in case of visible start time picker
						if (that.byId("startTimePick").getVisible()) {
							if (oSuccess.CalculateLeaveSpan.BeginTime) {
								oViewModel.setProperty(sCurrentLeaveRequestPath + "/StartTime", oSuccess.CalculateLeaveSpan.BeginTime);
							} else {
								// Fallback: Set initial start time if no value came back
								oViewModel.setProperty(sCurrentLeaveRequestPath + "/StartTime", "");
							}
						}
						//Proceed only in case of visible end time picker
						if (that.byId("endTimePick").getVisible()) {
							if (oSuccess.CalculateLeaveSpan.EndTime) {
								oViewModel.setProperty(sCurrentLeaveRequestPath + "/EndTime", oSuccess.CalculateLeaveSpan.EndTime);
							} else {
								// Fallback: Set initial start time if no value came back
								oViewModel.setProperty(sCurrentLeaveRequestPath + "/EndTime", "");
							}
						}
						// Set hour value if not initiated by the hour field itself
					} else {
						//proceed only in case of visible hour field
						if (that.byId("hoursValue").getVisible()) {
							if (oSuccess.CalculateLeaveSpan.AttabsHours) {
								oViewModel.setProperty(sCurrentLeaveRequestPath + "/PlannedWorkingHours", oSuccess.CalculateLeaveSpan.AttabsHours);
							}
						}
					}
				}
			}, function(oError) {
				jQuery.sap.log.error(
					"An error occurred while calling CalcLeaveDays function import",
					oError
				);
				that.oLocalModel.setProperty("/create-usedWorkingTime", null);
				that.oLocalModel.setProperty("/create-usedWorkingTimeUnit", null);
			});
		},

		_updateAvailableQuota: function() {
			var that = this;
			//Calculate only for multiple day selection        

			var sCalculatingText = this.getResourceBundle().getText("availabilityCalculation");
			that.oLocalModel.setProperty("/create-BalanceAvailableQuantity", sCalculatingText);
			that.oLocalModel.setProperty("/create-TimeUnitName", null);

			return this._callAvailableQuotaFunctionImport({
				AbsenceTypeCode: this.getSelectedAbsenceTypeControl().getBindingContext().getObject().AbsenceTypeCode,
				EmployeeID: this.getSelectedAbsenceTypeControl().getBindingContext().getObject().EmployeeID,
				InfoType: this.getSelectedAbsenceTypeControl().getBindingContext().getObject().InfoType
			}).then(function(oAvailableDays) {
				var sTimeUnitName,
					fDuration;

				if (!oAvailableDays) {
					that.oLocalModel.setProperty("/create-BalanceAvailableQuantity", null);
					that.oLocalModel.setProperty("/create-TimeUnitName", null);
					return;
				}

				// how long...                
				fDuration = parseFloat(oAvailableDays.CalculateQuotaAvailable.BalanceRestPostedRequested);

				// ...days/hours
				sTimeUnitName = that._lastBalanceTimeUnitName; // fallback
				if (oAvailableDays.CalculateQuotaAvailable.TimeUnitText) {
					sTimeUnitName = oAvailableDays.CalculateQuotaAvailable.TimeUnitText; // this is preferred
				}

				that.oLocalModel.setProperty("/create-BalanceAvailableQuantity", fDuration);
				that.oLocalModel.setProperty("/create-TimeUnitName", sTimeUnitName);

			}, function(oError) {
				jQuery.sap.log.error(
					"An error occurred while calling CalcLeaveDays function import",
					oError
				);
				that.oLocalModel.setProperty("/create-BalanceAvailableQuantity", null);
				that.oLocalModel.setProperty("/create-TimeUnitName", null);
			});
		},

		_copyMultipleApproversIntoModel: function(oModel, sPath, aApprovers) {
			Array.apply(null, {
				length: I_MAX_APPROVERS
			}).forEach(function(oUndefined, iIdx) {
				var oApprover = aApprovers[iIdx];
				if (!oApprover) {
					//   Send empty approver if removed before
					oApprover = {
						Name: "",
						Pernr: "00000000",
						Seqnr: "000",
						DefaultFlag: ""
					};
				}
				//oModel.setProperty(sPath + "/ApproverLvl" + (iIdx + 1), oApprover);
				oModel.setProperty(sPath + "/ApproverLvl" + (iIdx + 1) + "/Name", oApprover.Name);
				oModel.setProperty(sPath + "/ApproverLvl" + (iIdx + 1) + "/Pernr", oApprover.Pernr);
				oModel.setProperty(sPath + "/ApproverLvl" + (iIdx + 1) + "/Seqnr", oApprover.Seqnr);
				oModel.setProperty(sPath + "/ApproverLvl" + (iIdx + 1) + "/DefaultFlag", oApprover.DefaultFlag);
			});
			//Forward the information whether we are running in a multiple approver scenario from AbsensceType to the LeaveRequest in create case
			if (!this._editMode) {
				oModel.setProperty(sPath + "/IsMultiLevelApproval", this.oLocalModel.getProperty("/create-MultipleApproverFlag"));
			}
		},

		_getApprovers: function(bMultipleApprovers, oSingleApproverData, aMultipleApproverCollectionIds) {
			var oViewModel = this.getViewModel();
			if (!bMultipleApprovers) {
				var oSingleApprover = {
					Name: oViewModel.getProperty("/" + aMultipleApproverCollectionIds + "/Name"),
					Pernr: oViewModel.getProperty("/" + aMultipleApproverCollectionIds + "/Pernr"),
					Seqnr: oViewModel.getProperty("/" + aMultipleApproverCollectionIds + "/Seqnr"),
					DefaultFlag: oViewModel.getProperty("/" + aMultipleApproverCollectionIds + "/DefaultFlag")
				};
				return [oSingleApprover];
			}
			// render from multiple approvers
			return aMultipleApproverCollectionIds.map(function(sMultipleApproverCollectionId) {
				return {
					Name: oViewModel.getProperty("/" + sMultipleApproverCollectionId + "/Name"),
					Pernr: oViewModel.getProperty("/" + sMultipleApproverCollectionId + "/Pernr"),
					Seqnr: oViewModel.getProperty("/" + aMultipleApproverCollectionIds + "/Seqnr"),
					DefaultFlag: oViewModel.getProperty("/" + aMultipleApproverCollectionIds + "/DefaultFlag")
				};
			});
		},

		_getEditApprovers: function(bMultipleApprovers, oSingleApproverData, aMultipleApproverCollectionIds) {
			if (!bMultipleApprovers) {
				return [oSingleApproverData];
			}
			var aMultipleApproversForAbsence = [];
			for (var i = 0; i < aMultipleApproverCollectionIds.length; i++) {
				aMultipleApproversForAbsence[i] = {
					Name: aMultipleApproverCollectionIds[i].Name,
					Pernr: aMultipleApproverCollectionIds[i].Pernr,
					Seqnr: aMultipleApproverCollectionIds[i].Seqnr,
					DefaultFlag: aMultipleApproverCollectionIds[i].DefaultFlag
				};
			}
			return aMultipleApproversForAbsence;
		},

		_waitOnEmployeeId: function(sRoutArg) {
			if (!sRoutArg) {
				return this.getOwnerComponent().employeeIdPromise;
			}

			return new Promise(function(fnResolve, fnReject) {
				fnResolve(sRoutArg);
			});
		},

		/**
		 * Returns the default value of a given additional field.
		 *
		 * @param {string} sFieldType
		 *   a one character type (usually coming in the Type_Kind field from
		 *   OData service).
		 *
		 * @returns {variant}
		 *   the default value for the given type of additional field
		 */
		_getAdditionalFieldDefaultValue: function(sFieldType) {
			var vDefault = "";

			switch (sFieldType) {
				case "T":
					vDefault = null;
					break;
				case "D":
					vDefault = null;
					break;
				default:
					/* C, N, P */
					vDefault = "";
			}

			return vDefault;
		},

		_getAdditionalFieldValues: function(oAdditionalFieldPaths, oValues) {
			var that = this;
			var oAdditionalFieldValues = {};

			oAdditionalFieldPaths.forEach(function(sAdditionalFieldPath) {
				var vAdditionalFieldValue,
					sAdditionalFieldId,
					oAdditionalField;

				oAdditionalField = that.getViewModel().getObject("/" + sAdditionalFieldPath);
				sAdditionalFieldId = sAdditionalFieldPath.split("('")[1].replace("')", "");

				if (oValues.hasOwnProperty(sAdditionalFieldId)) {
					// use the value if we have it
					vAdditionalFieldValue = oValues[sAdditionalFieldId];
				} else {
					vAdditionalFieldValue = that._getAdditionalFieldDefaultValue(oAdditionalField.Type_Kind);
				}
				oAdditionalFieldValues[sAdditionalFieldId] = vAdditionalFieldValue;
			});

			return oAdditionalFieldValues;
		},

		_getCurrentAdditionalFieldValues: function() {
			// Current values are bound to local model
			var oCurrentValues = {};

			this.oLocalModel.getProperty("/create-AdditionalFields").forEach(function(oField) {
				oCurrentValues[oField.Fieldname] = oField.value;
			});

			return oCurrentValues;
		},

		_fillAdditionalFields: function(oModel, sAbsenceTypeCode, oContainer) {
			oContainer.removeAllContent();

			oModel.getProperty("/create-AdditionalFields").forEach(function(oAdditionalField, iIdx) {
				var sFragmentName = this._getAdditionalFieldFragmentName(oAdditionalField);

				if (!this._oAdditionalFieldsControls[oAdditionalField.Fieldname]) {
					if (sFragmentName) {
						this._oAdditionalFieldsControls[oAdditionalField.Fieldname] = sap.ui.xmlfragment(
							this.getView().getId() + oAdditionalField.Fieldname,
							"hcm.fab.myleaverequest.view.fragments." + sFragmentName,
							this /* the fragment's controller */ );

					} else {
						this._addAdditionalFieldDecimal(this.getView(), oContainer, oModel, iIdx, this.onNumberChange, oAdditionalField, this._oAdditionalFieldsControls);
					}
				}

				this._oAdditionalFieldsControls[oAdditionalField.Fieldname].forEach(function(oControl) {
					// Bind to models
					//
					// Set binding context first to avoid useless update when the
					// model is set...
					oControl.setBindingContext(
						oModel.createBindingContext("/create-AdditionalFields/" + iIdx),
						"local"
					);
					this.getView().addDependent(oControl);
					oContainer.addContent(oControl);
				}.bind(this));

			}.bind(this));
		},

		_addAdditionalFieldDecimal: function(oView, oContainer, oModel, iIndex, fnNumberChange, oAdditionalField, oAddFields) {
			//decimal field with variable precision and scale
			var sId = oView.getId() + oAdditionalField.Fieldname + "addFieldInputDecimal";

			//Label
			var oLabel = new Label(sId + "Label", {
				required: "{local>Required}",
				text: "{local>FieldLabel}"
			});
			oLabel.setBindingContext(
				oModel.createBindingContext("/create-AdditionalFields/" + iIndex),
				"local"
			);
			oView.addDependent(oLabel);
			oContainer.addContent(oLabel);

			//Input Fields
			var oInput = new Input(sId, {
				type: "Text",
				change: fnNumberChange,
				textAlign: "Right",
				enabled: "{ formatter: 'hcm.fab.myleaverequest.utils.formatters.isGroupEnabled', parts: [ { path: 'StartDate' }, { path: 'AbsenceTypeCode' } ]}"
			});

			oInput.setBindingContext(
				oModel.createBindingContext("/create-AdditionalFields/" + iIndex),
				"local"
			);

			//field-dependent value binding
			oInput.bindValue({
				path: "local>value",
				type: new sap.ui.model.odata.type.Decimal({
					parseAsString: true,
					decimals: parseInt(oAdditionalField.Decimals),
					maxIntegerDigits: (parseInt(oAdditionalField.Length) - parseInt(oAdditionalField.Decimals)),
					minFractionDigits: 0,
					maxFractionDigits: parseInt(oAdditionalField.Decimals)
				}, {
					precision: parseInt(oAdditionalField.Length),
					scale: parseInt(oAdditionalField.Decimals)
				})
			});

			oView.addDependent(oInput);
			oContainer.addContent(oInput);

			if (!oAddFields[oAdditionalField.Fieldname]) {
				oAddFields[oAdditionalField.Fieldname] = [];
				oAddFields[oAdditionalField.Fieldname].push(oLabel);
				oAddFields[oAdditionalField.Fieldname].push(oInput);
			}
		},

		/*
		 * Copies additional fields value saved in the local model to the view
		 * model.
		 */
		_copyAdditionalFieldsIntoModel: function(aAdditionalFieldsProperty, oModel, sBasePath) {
			aAdditionalFieldsProperty.forEach(function(oAdditionalFieldProperty) {
				var sFieldName = oAdditionalFieldProperty.Fieldname;
				var vFieldValue = oAdditionalFieldProperty.value;
				// Boolean are treated as 'X'/'' (Edm.String type) by the backend
				if (typeof vFieldValue === "boolean" && oAdditionalFieldProperty.Type_Kind === "C") {
					vFieldValue = vFieldValue ? "X" : "";
				}
				//
				// We use sap.ui.model.Integer type for "P" integer fields to
				// do the validation. Although we must convert the value to
				// string here because the OData model expects an Edm.String
				// type.
				//
				if (formatter.isAdditionalFieldInputInteger(oAdditionalFieldProperty.Type_Kind)) {
					vFieldValue = vFieldValue + "";
				}
				// Handle no number in decimal field
				if (typeof vFieldValue === "string" && vFieldValue === "" && oAdditionalFieldProperty.Type_Kind === "P") {
					vFieldValue = null;
				}
				oModel.setProperty(sBasePath + "/AdditionalFields/" + sFieldName, vFieldValue);
			});
		},

		_updateLocalModel: function(
			aApprovers,
			oAdditionalFields,
			oAbsenceTypeData,
			oLeaveRequestStartEndDates
		) {
			var aAdditionalFields,
				sCalculatingText,
				that;

			that = this;

			sCalculatingText = this.getResourceBundle().getText("availabilityCalculation");
			aAdditionalFields = oAdditionalFields.definition.map(function(sAdditionalFieldPath) {
				var oFieldMapping,
					sAdditionalFieldId,
					oAdditionalField;

				oAdditionalField = that.getViewModel().getObject("/" + sAdditionalFieldPath);
				sAdditionalFieldId = sAdditionalFieldPath.split("('")[1].replace("')", "");

				oAdditionalField.value = oAdditionalFields.values[sAdditionalFieldId];

				oFieldMapping = O_SEARCH_HELPER_MAPPINGS[oAdditionalField.Fieldname];
				if (!oFieldMapping) {
					oFieldMapping = {};
				}

				oAdditionalField.additionalFieldKey = oFieldMapping.keyField;
				oAdditionalField.F4EntityTitleField = oFieldMapping.titleField;
				oAdditionalField.F4EntityDescriptionField = oFieldMapping.descriptionField;
				oAdditionalField.F4SearchFilter = oFieldMapping.searchFields;

				return oAdditionalField;
			});

			// Decide initial radio button
			var iInitialGroupIndex = 0; // multi-day
			if (
				// -> likely 1 day or less
				!formatter.isMoreThanOneDayAllowed(oAbsenceTypeData.IsAllowedDurationMultipleDay) ||
				// same start and end dates + one day or less allowed
				(
					formatter.isOneDayOrLessAllowed(
						oAbsenceTypeData.IsAllowedDurationMultipleDay,
						oAbsenceTypeData.IsAllowedDurationSingleDay
					) && oLeaveRequestStartEndDates && oLeaveRequestStartEndDates.StartDate && oLeaveRequestStartEndDates.EndDate &&
					oLeaveRequestStartEndDates.StartDate.getTime() === oLeaveRequestStartEndDates.EndDate.getTime() && oLeaveRequestStartEndDates.StartDate instanceof Date
				)
			) {
				iInitialGroupIndex = 1; // single-day
			}

			this.setModelProperties(this.oLocalModel, {
				"create-multiOrSingleDayRadioGroupIndex": iInitialGroupIndex, // bound TwoWay in view
				"create-attachmentsVisible": oAbsenceTypeData.AttachmentEnabled,
				"create-attachmentsMandatory": oAbsenceTypeData.AttachmentMandatory,
				"create-BalanceAvailableQuantity": sCalculatingText,
				"create-TimeUnitName": undefined,
				"create-AllowedDurationMultipleDayInd": oAbsenceTypeData.IsAllowedDurationMultipleDay,
				"create-AllowedDurationPartialDayInd": oAbsenceTypeData.IsAllowedDurationPartialDay,
				"create-AllowedDurationSingleDayInd": oAbsenceTypeData.IsAllowedDurationSingleDay,
				"create-approverLevel": oAbsenceTypeData.ApproverLevel,
				"create-addDelApprovers": oAbsenceTypeData.AddDelApprovers,
				"create-MultipleApprovers": aApprovers,
				"create-AdditionalFields": aAdditionalFields,
				"create-MultipleApproverFlag": oAbsenceTypeData.IsMultiLevelApproval,
				"create-readOnlyApprover": oAbsenceTypeData.IsApproverReadOnly,
				"create-isApproverVisible": oAbsenceTypeData.IsApproverVisible,
				"create-isNoteVisible": oAbsenceTypeData.IsNoteVisible,
				"create-showTimePicker": oAbsenceTypeData.IsRecordInClockTimesAllowed,
				"create-showInputHours": oAbsenceTypeData.IsRecordInClockHoursAllowed,
				"create-isQuotaCalculated": oAbsenceTypeData.IsQuotaUsed
			});
			this._updateLocalModelWithAvailableQuota();
		},

		_updateLocalModelWithAvailableQuota: function() {
			this._updateAvailableQuota();
		},

		_uploadAttachments: function(oParams) {
			var that = this;

			return new Promise(function(fnResolve, fnReject) {
				var aAttachments,
					oUploadCollection,
					aUploadedFiles,
					aDeletionFiles,
					sUploadUrl,
					fnDeleteComplete,
					fnUploadComplete;

				oUploadCollection = that.byId("AttachmentCollection");

				aAttachments = oUploadCollection.getItems();
				that._uploadsCompleted = 0;
				that._uploadProgressTotal = aAttachments.length;

				var iUploadFiles = 0;
				aAttachments.forEach(function(oAttachments) {
					if (oAttachments._status !== "display") {
						iUploadFiles++;
					}
				});
				if (iUploadFiles == 0) {
					fnResolve({
						uploadedFiles: aUploadedFiles,
						viewModel: oParams.viewModel,
						leavePath: oParams.leavePath
					});
					return;
				}
				that._uploadProgressTotal = iUploadFiles;

				// prepare
				sUploadUrl = that._getAttachmentsUploadUrl();
				var iRealFilesToUpload = that._updateUploadUrls(aAttachments, sUploadUrl);

				// show progress immediately...
				that.oLocalModel.setProperty("/create-uploadPercentage", 0.25);

				// ------ handle upload process ------

				aUploadedFiles = []; // information about each uploaded file

				fnUploadComplete = function(oEvent) {
					that._uploadsCompleted++;
					var fPercentage = (that._uploadsCompleted / that._uploadProgressTotal * 100);
					that.oLocalModel.setProperty("/create-uploadPercentage", fPercentage);

					// gather information about uploaded file
					aUploadedFiles.push({
						FileName: oEvent.getParameters().files[0].fileName
							// TODO: continue filling here...
							// FileUrl: "http://www.google.com"
					});
					if (fPercentage >= 100) {
						// done uploading
						oUploadCollection.detachUploadComplete(fnUploadComplete);
						fnResolve({
							uploadedFiles: aUploadedFiles,
							viewModel: oParams.viewModel,
							leavePath: oParams.leavePath
						});
					}
				};
				oUploadCollection.attachUploadComplete(fnUploadComplete);
				//take care about deleted items since Upload Collection cannot handle it
				oUploadCollection._aDeletedItemForPendingUpload = [];
				// upload
				oUploadCollection.upload();
			});
		},

		_initOverlapCalendar: function() {
			this.oLocalModel.setProperty("/calendar/assignmentId", this.sCEEmployeeId);
			if (!this._oOverlapCalendar) {
				this.oLocalModel.setProperty("/calendar/overlapNumber", 0);
				this._oOverlapCalendar = new TeamCalendarControl({
					id: "overlapTeamCalendar",
					applicationId: "MYLEAVEREQUESTS",
					instanceId: "OVERLAP",
					assignmentId: "{local>/calendar/assignmentId}",
					requesterId: "{local>/calendar/assignmentId}",
					startDate: "{StartDate}",
					leaveRequestMode: true,
					leaveRequestSimulateRequest: true,
					leaveRequestStartDate: "{StartDate}",
					leaveRequestEndDate: "{EndDate}",
					leaveRequestDescription: "{i18n>calendarOverlapLeaveRequestText}",
					dataChanged: function(oEvent) {
						this.oLocalModel.setProperty("/calendar/overlapNumber", oEvent.getParameter("employeeConflictList").length);
					}.bind(this)
				});
				this.getView().addDependent(this._oOverlapCalendar);
			}
		},

		onOverlapOpen: function() {
			if (!this._overlapDialog) {
				this.getView().removeDependent(this._oOverlapCalendar);

				this._overlapDialog = new Dialog({
					title: "{i18n>overlapCalendarLabel}",
					contentWidth: "1000px",
					contentHeight: "800px",
					draggable: true,
					resizable: true,
					stretch: Device.system.phone,
					content: [
						this._oOverlapCalendar
					],
					beginButton: [
						new Button({
							text: "{i18n>calendarOverlapCloseButtonText}",
							tooltip: "{i18n>calendarOverlapCloseButtonText}",
							press: function() {
								this._overlapDialog.close();
							}.bind(this)
						})
					]
				});
				this.getView().addDependent(this._overlapDialog);
			}
			this._overlapDialog.open();
		}
	});
});