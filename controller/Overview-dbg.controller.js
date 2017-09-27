/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/myleaverequest/utils/utils",
	"hcm/fab/myleaverequest/utils/formatters",
	"hcm/fab/lib/common/util/TeamCalendarDataManager",
	"jquery.sap.storage",
	"sap/ui/Device",
	"hcm/fab/myleaverequest/controller/BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/routing/History",
	"sap/ui/unified/DateRange",
	"sap/ui/unified/DateTypeRange",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem"	
], function(utils, formatter, TeamCalendarDataManager, storage, Device, BaseController, Filter, FilterOperator, History, DateRange,
	DateTypeRange, JSONModel, MessageBox, MessagePopover, MessagePopoverItem) {
	"use strict";

	/* global Promise */

	return BaseController.extend("hcm.fab.myleaverequest.controller.Overview", {

		oODataModel: null,
		oDialog: null,
		previousRange: null,
		CALENDARPERSKEY: "showCalendar",
		ENTITLEMENTSPERSKEY: "expandEntitlements",
		OVERVIEWPERSKEY: "expandOverview",
		oStorage: jQuery.sap.storage(jQuery.sap.storage.Type.local),
		_refresh: false,
		_oQuickView: undefined,
		_oMessagePopover: null,
		sCEEmployeeId: undefined,
		formatter: formatter,

		onInit: function() {
			// Model used to manipulate control states
			var oLocalModel = new JSONModel({
				showCalendar: !!this.oStorage.get(this.CALENDARPERSKEY),
				viewSelection: this.oStorage.get(this.CALENDARPERSKEY) ? "calendar" : "list",
				entCount: 0,
				overviewCountText: this.getResourceBundle().getText("items", "0"),
				entitlementsExpanded: !!this.oStorage.get(this.ENTITLEMENTSPERSKEY),
				overviewExpanded: !!this.oStorage.get(this.OVERVIEWPERSKEY),
				calendarBusy: false
			});

			this.setModel(oLocalModel, "local");

			this.oODataModel = this.getOwnerComponent().getModel();
			this.oErrorHandler = this.getOwnerComponent().getErrorHandler();

			this._oTeamCalendarDataManager = new TeamCalendarDataManager();
			var oCalPromise = Promise.resolve();

			var that = this;
			var dataLoaded = this.oODataModel.metadataLoaded();
			var oEmployeeIdPromise = this.getOwnerComponent().getAssignmentId();
			Promise.all([dataLoaded, oCalPromise, oEmployeeIdPromise]).then(function(aData) {
				that.onMetaDataLoaded(aData[2]);
			}).catch(function(oErr) {
				var oError = oErr;
			});

			var bShowCalendar = oLocalModel.getProperty("/showCalendar");
			this._toggleCalendarModel(bShowCalendar);

			var bExpandEntitlements = oLocalModel.getProperty("/entitlementsExpanded");
			this._toggleEntitlements(bExpandEntitlements);

			var bExpandOverview = oLocalModel.getProperty("/overviewExpanded");
			this._toggleOverview(bExpandOverview);

			this.getRouter().getRoute("overview").attachPatternMatched(this._onRouteMatched, this);

			sap.ui.getCore().getEventBus().subscribe("hcm.fab.myleaverequest", "invalidateoverview", function() {
				this._refresh = true;
			}, this);

			this.getView().byId("quotaUsedColTxt").addStyleClass(Device.system.desktop ? "sapUiLargeMarginEnd" : undefined);
			this.getView().byId("quotaUsedCell").addStyleClass(Device.system.desktop ? "sapMTableContentMargin sapUiLargeMarginEnd" :
				"sapMTableContentMargin");

		},

		onExit: function() {
			this.oErrorHandler.clearErrors();
			if (this._oQuickView) {
				this._oQuickView.destroy();
				this._oQuickView = undefined;
			}
		},

		onMetaDataLoaded: function(sEmployeeId) {
			this._initOverviewModelBinding(sEmployeeId);
			//Keep initial CE Employee Id
			this.sCEEmployeeId = sEmployeeId;
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		onEntitlementDateChanged: function(oEvent) {
			var aFilter = [];
			var oCalendar = oEvent.getSource();
			//var sQuery = oCalendar.getDateValue();
			var sQuery = utils.dateToUTC(oCalendar.getDateValue());

			var table = this.getView().byId("entitlementTable");
			var binding = table.getBinding("items");

			if (sQuery) {
				aFilter.push(new Filter("FilterStartDate", FilterOperator.GE, sQuery));
				aFilter.push(new Filter("EmployeeID", FilterOperator.EQ, this.sCEEmployeeId));
				binding.filter(aFilter, "Application");
			} else {
				binding.filter(null);
			}
		},

		onUpdateFinishedEntitlements: function(oEvent) {
			this.getModel("local").setProperty("/entCount", oEvent.getParameter("total"));
		},

		onUpdateFinishedOverview: function(oEvent) {
			this.getModel("local").setProperty("/overviewCountText", this.getResourceBundle().getText("items", oEvent.getParameter("total")));
		},

		/**
		 * Event handler when the createLeave Button got pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onCreateLeave: function() {
			// The source is the list item that got pressed
			var oCalendar = this.getView().byId("calendar");
			var aSelectedDates = oCalendar.getSelectedDates();
			var oRouter = this.getRouter();
			if (aSelectedDates.length === 0) {
				oRouter.navTo("creation");
			} else {
				var dateRange = aSelectedDates[0];
				var oStartDate = dateRange.getStartDate();
				var oStartDateValue = new Date(Date.UTC(oStartDate.getFullYear(), oStartDate.getMonth(), oStartDate.getDate()));
				oCalendar.destroySelectedDates();
				oRouter.navTo("creationWithParams", {
					dateFrom: "" + utils.dateToUTC(oStartDateValue).getTime(),
					dateTo: "" + utils.dateToUTC(oStartDateValue).getTime(),
					absenceType: "default",
					sEmployeeID: this.sCEEmployeeId
				});
			}
		},

		onClose: function() {
			this.oDialog.close();
		},

		onItemPressed: function(oEvent) {
			var oContext = oEvent.getParameter("listItem").getBindingContext();
			var sPath = oContext.getPath().substr(1);

			var oRouter = this.getRouter();
			oRouter.navTo("display", {
				leavePath: sPath
			});
		},
		onEntitlementItemPressed: function(oEvent) {
			var oContext = oEvent.getParameter("listItem").getBindingContext();

			if (!this._oQuickView) {
				this._oQuickView = sap.ui.xmlfragment("hcm.fab.myleaverequest.view.fragments.EntitlementDetail", this);
				this.getView().addDependent(this._oQuickView);
			}
			this._oQuickView.setBindingContext(oContext);
			this._oQuickView.openBy(oEvent.getSource());
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

		/**
		 * Event handler for navigating back.
		 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
		 * If not, it will navigate to the shell home
		 * @public
		 */
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

		// onSearch: function(oEvent) {
		// 	if (oEvent.getParameters().refreshButtonPressed) {
		// 		// Search field's 'refresh' button has been pressed.
		// 		// This is visible if you select any master list item.
		// 		// In this case no new search is triggered, we only
		// 		// refresh the list binding.
		// 		var oBinding = this._oTable.getBinding("items");
		// 		oBinding.refresh();
		// 	} else {
		// 		var oTableSearchState = [];
		// 		var sQuery = oEvent.getParameter("query");

		// 		if (sQuery && sQuery.length > 0) {
		// 			oTableSearchState = [new Filter("Username", FilterOperator.Contains, sQuery)];
		// 		}
		// 		this._applySearch(oTableSearchState);
		// 	}
		// },

		// onLiveSearch: function(oEvent) {
		// 	var table = this.getView().byId("leaveRequestTable");
		// 	var binding = table.getBinding("items");

		// 	var aFilter = [];
		// 	var sQuery = oEvent.getSource().getValue();
		// 	var lfnFormatDate = function(value) {
		// 		var oDate = new sap.ui.model.odata.type.DateTime({
		// 			oConstraints: {
		// 				displayFormat: "Date"
		// 			}
		// 		});
		// 		var sValue = oDate.formatValue(new Date(value), "string");
		// 		sValue = sValue.toLowerCase();
		// 		return sValue.indexOf(sQuery.toLowerCase()) !== -1;
		// 	};
		// 	if (sQuery && sQuery.length > 0) {
		// 		aFilter.push(new Filter("AbsenceTypeName", FilterOperator.Contains, sQuery));
		// 		aFilter.push(new Filter("ApproverEmployeeName", FilterOperator.Contains, sQuery));
		// 		aFilter.push(new Filter("WorkingDaysDuration", FilterOperator.Contains, sQuery));
		// 		aFilter.push(new Filter("StatusTxt", FilterOperator.Contains, sQuery));
		// 		aFilter.push(new Filter("EndDate", lfnFormatDate));
		// 		aFilter.push(new Filter("StartDate", lfnFormatDate));
		// 		binding.filter(new Filter(aFilter, false), "Application");
		// 	} else {
		// 		binding.filter(null);
		// 	}
		// },

		// onSearchEntitlement: function(oEvent) {
		// 	var table = this.getView().byId("entitlementTable");
		// 	var binding = table.getBinding("items");

		// 	var aFilter = [];
		// 	var sQuery = oEvent.getSource().getValue();
		// 	if (sQuery && sQuery.length > 0) {
		// 		aFilter.push(new Filter("BalanceAvailableQuantity", sap.ui.model.FilterOperator.Contains, sQuery));
		// 		aFilter.push(new Filter("BalanceUsedQuantity", sap.ui.model.FilterOperator.Contains, sQuery));
		// 		aFilter.push(new Filter("BalanceEntitlementQuantity", sap.ui.model.FilterOperator.Contains, sQuery));
		// 		aFilter.push(new Filter("TimeAccountTypeName", sap.ui.model.FilterOperator.Contains, sQuery));
		// 		aFilter.push(new Filter("TimeUnitTxt", sap.ui.model.FilterOperator.Contains, sQuery));
		// 		binding.filter(new Filter(aFilter, false), "Application");
		// 	} else {
		// 		binding.filter(null);
		// 	}
		// },

		onDeleteSwipe: function(oEvent) {
			this._deleteRequest(oEvent.getSource().getParent().getSwipedItem());
		},

		onDeletePress: function(oEvent) {
			var oList = oEvent.getSource(),
				oItem = oEvent.getSource().getParent(),
				oComponent = this.getOwnerComponent();

			// get user confirmation first			
			MessageBox.confirm(this.getResourceBundle().getText("confirmDeleteMessage"), {
				styleClass: oComponent.getContentDensityClass(),
				initialFocus: MessageBox.Action.CANCEL,
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.OK) {
						// after deletion put the focus back to the list
						oList.attachEventOnce("updateFinished", oList.focus, oList);
						this._deleteRequest(oItem);
					}
				}.bind(this)
			});
		},

		onEditPress: function(oEvent) {
			var oRouter = this.getRouter();
			var sPath = oEvent.getSource().getBindingContext().getPath();
			oRouter.navTo("edit", {
				leavePath: sPath.substr(1)
			});
		},

		onStartDateChange: function(oEvent) {
			var aFilter = [];
			var oCalendar = oEvent.getSource();
			var oNewDate = utils.dateToUTC(oCalendar.getDateValue());

			var oBinding = this.getView().byId("leaveRequestTable").getBinding("items");
			if (oNewDate) {
				aFilter.push(new Filter("StartDate", FilterOperator.GE, oNewDate));
				aFilter.push(new Filter("EmployeeID", FilterOperator.EQ, this.sCEEmployeeId));
				oBinding.filter(aFilter, "Application");
			} else {
				oBinding.filter(null);
			}
		},

		onDateSelect: function(oEvent) {
			var cal = oEvent.getSource();
			var aDates = cal.getSelectedDates();
			var dateRange = aDates[0];
			var oStartDate = dateRange.getStartDate();
			var oStartDateValue = new Date(Date.UTC(oStartDate.getFullYear(), oStartDate.getMonth(), oStartDate.getDate()));
			var oEndDate = dateRange.getEndDate();
			var oEndDateValue;
			if (oEndDate) {
				oEndDateValue = new Date(Date.UTC(oEndDate.getFullYear(), oEndDate.getMonth(), oEndDate.getDate()));
			}
			var oRouter = this.getRouter();

			//@todo: multiple dates found for selection
			var aSpecialDates = [];
			if (oStartDateValue && !oEndDateValue) {
				aSpecialDates = cal.getSpecialDates().filter(function(value) { //find leave requests on selected date
					return value.getStartDate() <= oStartDateValue && value.getEndDate() >= oStartDateValue;
				});
			}

			switch (aSpecialDates.length) {
				case 0:
					if (oEndDateValue) {
						cal.destroySelectedDates();
						oRouter.navTo("creationWithParams", {
							dateFrom: "" + utils.dateToUTC(oStartDateValue).getTime(),
							dateTo: "" + utils.dateToUTC(oEndDateValue).getTime(),
							absenceType: "default",
							sEmployeeID: this.sCEEmployeeId
						});
					}
					break;
				case 1:
				default:
					cal.destroySelectedDates();
					oRouter.navTo("display", {
						leavePath: aSpecialDates[0].data("path")
					});
					break;
			}
		},

		onAssignmentSwitch: function(oEvent) {
			this.sCEEmployeeId = oEvent.getParameter("selectedAssignment");
			this.getOwnerComponent().setAssignmentId(this.sCEEmployeeId);
			this._initOverviewModelBinding(this.sCEEmployeeId);
		},

		onSelect: function(oEvent) {
			var sSelectedKey = oEvent.getParameter("key");
			if (sSelectedKey === "calendar" || sSelectedKey === "list") {
				this._toggleCalendarModel(sSelectedKey === "calendar");
				this.getView().byId("overviewPanel").invalidate();
			}
		},

		onEntitlementPanelExpand: function(oEvent) {
			this._toggleEntitlements(oEvent.getParameter("expand"));
		},
		onOverviewPanelExpand: function(oEvent) {
			this._toggleOverview(oEvent.getParameter("expand"));
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		_fillCalendarData: function(oData) {
			var oCalendar = this.getView().byId("calendar");
			var aData = oData.results;

			//oCalendar.destroySpecialDates();
			if (aData) {
				for (var i = 0; i < aData.length; i++) {
					var oLeave = aData[i];
					var oDateRange = new DateTypeRange({
						startDate: oLeave.StartDate,
						endDate: oLeave.EndDate,
						type: formatter.statusCodeFormatter(oLeave.StatusID),
						tooltip: oLeave.StatusTxt,
						customData: {
							key: "path",
							value: this.getModel().createKey("/LeaveRequestSet", oLeave).substr(1)
						}
					});
					oCalendar.addSpecialDate(oDateRange);
				}
			}
		},

		_toggleCalendarModel: function(bShowCal) {
			this.getModel("local").setProperty("/showCalendar", bShowCal);
			this.getModel("local").setProperty("/viewSelection", bShowCal ? "calendar" : "list");
			this.oStorage.put(this.CALENDARPERSKEY, bShowCal);

		},
		_onRouteMatched: function() {
			this.oErrorHandler.setShowErrors("immediately");
			this.oErrorHandler.clearErrors();
			if (this._refresh) {
				this._refresh = false;
				this._refreshAbsences();
				this._refreshEntitlements();
			}
		},

		_initOverviewModelBinding: function(sEmployeeId) {
			// Read Leave Request with in sync with Default Start value (which is under the separate config entity)
			this._readLeaveRequestWithDefaultStartDate(sEmployeeId);

			// Read the available entitlements
			this._readEntitlements(sEmployeeId);

		},

		_readEntitlements: function(sEmployeeId) {
			this.getModel("local").setProperty("/entitlementStartDate", new Date());
			this._oEntitlementColumListItemTemplate = this._oEntitlementColumListItemTemplate ? this._oEntitlementColumListItemTemplate.clone() :
				this.getView().byId(
					"entitlementColumnListItem");
			// Init Entitlement table            
			this.getView().byId("entitlementTable").bindItems({
				path: "/TimeAccountSet",
				parameters: {
					operationMode: "Server"
				},
				template: this._oEntitlementColumListItemTemplate,
				filters: this._getActiveBaseFiltersForTimeAccount(new Date(), sEmployeeId)
			});
		},

		_readLeaveRequestWithDefaultStartDate: function(employeeId) {
			var aFilter = [];
			aFilter.push(new Filter("EmployeeID", FilterOperator.EQ, employeeId));

			this.oODataModel.read("/ConfigurationSet", {
				success: function(oResult) {
					var defaultFilterDate = oResult.results[0].DefaultFilterDate;
					this._bindLeaveRequestList(defaultFilterDate, employeeId);
					//Set Date Picker on top of the list accordingly
					this.getModel("local").setProperty("/leaveRequestStartDate", defaultFilterDate);
				}.bind(this),

				//in case of errors about reading the default start value set the current year as fallback
				error: function() {
					var fallbackDate = new Date(Date.UTC(new Date().getFullYear(), null, 1));
					this._bindLeaveRequestList(fallbackDate, employeeId);
					//Set Date Picker on top of the list accordingly
					this.getModel("local").setProperty("/leaveRequestStartDate", fallbackDate);
				}.bind(this),
				filters: aFilter
			});
		},

		_bindLeaveRequestList: function(startDate, employeeId) {
			var oLocalModel = this.getModel("local"),
				oTable = this.getView().byId("leaveRequestTable");

			this._oLeaveRequestColumListItemTemplate = this._oLeaveRequestColumListItemTemplate ? this._oLeaveRequestColumListItemTemplate.clone() :
				this.getView().byId("leaveRequestColumnListItem");

			oLocalModel.setProperty("/calendarBusy", true);

			oTable.bindItems({
				path: "/LeaveRequestSet",
				parameters: {
					operationMode: "Server"
				},
				template: this._oLeaveRequestColumListItemTemplate,
				filters: this._getActiveBaseFiltersForLeave(startDate, employeeId),
				events: {
					dataReceived: function(oEvent) {
						// fill calendar with received leave request data
						var data = oEvent.getParameter("data");
						if (data && data.results) {
							this._fillCalendarData(data);
						}
						oLocalModel.setProperty("/calendarBusy", false);
					}.bind(this)
				}
			});
		},

		_getActiveBaseFiltersForTimeAccount: function(startDate, employeeId) {
			var aFilters = [];
			aFilters.push(new Filter("FilterStartDate", FilterOperator.GE, startDate));
			aFilters.push(new Filter("EmployeeID", FilterOperator.EQ, employeeId));

			return aFilters;
		},

		_getActiveBaseFiltersForLeave: function(startDate, employeeId) {
			var aFilters = [];
			aFilters.push(new Filter("StartDate", FilterOperator.GE, startDate));
			aFilters.push(new Filter("EmployeeID", FilterOperator.EQ, employeeId));

			return aFilters;
		},

		_refreshAbsences: function() {
			var oLeaveRequestTableBinding = this.getView().byId("leaveRequestTable").getBinding("items");
			oLeaveRequestTableBinding.refresh();
		},
		_refreshEntitlements: function() {
			var oEntitlementTableBinding = this.getView().byId("entitlementTable").getBinding("items");
			oEntitlementTableBinding.refresh();
		},

		_deleteRequest: function(oItem) {
			var sBindingPath = oItem.getBindingContext().getPath();

			this.getView().getModel().remove(sBindingPath, {
				success: function() {
					this._refreshEntitlements();
				}.bind(this),
				error: function(oError) {
					jQuery.sap.log.error(
						"An error occurred while removing LeaveRequest",
						oError
					);
				}
			});
		},

		_toggleEntitlements: function(bExpand) {
			var oLocalModel = this.getModel("local");
			this.oStorage.put(this.ENTITLEMENTSPERSKEY, bExpand);
			oLocalModel.setProperty("/entitlementsExpanded", bExpand);
		},
		_toggleOverview: function(bExpand) {
			var oLocalModel = this.getModel("local");
			this.oStorage.put(this.OVERVIEWPERSKEY, bExpand);
			oLocalModel.setProperty("/overviewExpanded", bExpand);
		}
	});
});