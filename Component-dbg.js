/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/core/routing/HashChanger",
	"hcm/fab/lib/common/util/CommonModelManager",
	"sap/ui/Device",
	"sap/ui/model/json/JSONModel",
	"hcm/fab/myleaverequest/model/models",
	"hcm/fab/myleaverequest/controller/ErrorHandler"
], function(UIComponent, HashChanger, CommonModelManager, Device, JSONModel, models, ErrorHandler) {
	"use strict";

	/* global Promise */
	return UIComponent.extend("hcm.fab.myleaverequest.Component", {
		metadata: {
			manifest: "json"
		},

		oMessageProcessor: null,
		oMessageManager: null,
		sEmployeeId: undefined,

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * In this function, the FLP and device models are set and the router is initialized.
		 * @public
		 * @override
		 */
		init: function() {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// initialize the message handler
			this.oMessageProcessor = new sap.ui.core.message.ControlMessageProcessor();
			this.oMessageManager = sap.ui.getCore().getMessageManager();

			this.oMessageManager.registerMessageProcessor(this.oMessageProcessor);

			// initialize the error handler with the component
			this._oErrorHandler = new ErrorHandler(this, this.oMessageProcessor, this.oMessageManager);

			// set the device model
			this.setModel(models.createDeviceModel(), "device");

			this.setModel(this.oMessageManager.getMessageModel(),"message");

			// create the views based on the url/hash
			this.getRouter().initialize();

			var oStartupParameters = this.getStartupParameters();
			if (oStartupParameters.action && !this.hasInnerAppRoute()) {
				this.navigateToView(oStartupParameters);
			}

		},
		hasInnerAppRoute: function() {
			var oURLParsing = sap.ushell.Container.getService("URLParsing");
			var sHash = HashChanger.prototype.getHash();
			var oParsedURL = oURLParsing.parseShellHash(sHash);

			return typeof oParsedURL.appSpecificRoute === "string" && oParsedURL.appSpecificRoute.length > 0;
		},
		
		navigateToView: function(oStartupParameters) {
			var sAction = oStartupParameters.action;
			var oAllowedActionParamValue = {
				"create": "creationWithParams"
			};

			if (!oAllowedActionParamValue[sAction]) {
				return;
			}

			var sTargetRoute = oAllowedActionParamValue[sAction];

			var that = this;
			that.getRouter().navTo(sTargetRoute, {
				absenceType: oStartupParameters.absenceType || "default",
				dateFrom: oStartupParameters.dateFrom || 0,
				dateTo: oStartupParameters.dateTo || 0
			});
		},
		getStartupParameters: function() {
			var oAllStartupParameters = this.getComponentData().startupParameters;
			var oStartupParameters = {};

			Object.keys(oAllStartupParameters).forEach(function(sParameter) {
				oStartupParameters[sParameter] = oAllStartupParameters[sParameter][0];
			});

			return oStartupParameters;
		},
		/**
		 * The component is destroyed by UI5 automatically.
		 * In this method, the ErrorHandler is destroyed.
		 * @public
		 * @override
		 */
		destroy: function() {
			this.getErrorHandler().destroy();
			// call the base component's destroy function
			UIComponent.prototype.destroy.apply(this, arguments);
		},

		/**
		 * This method can be called to determine whether the sapUiSizeCompact or sapUiSizeCozy
		 * design mode class should be set, which influences the size appearance of some controls.
		 * @public
		 * @return {string} css class, either 'sapUiSizeCompact' or 'sapUiSizeCozy' - or an empty string if no css class should be set
		 */
		getContentDensityClass: function() {
			if (this._sContentDensityClass === undefined) {
				// check whether FLP has already set the content density class; do nothing in this case
				if (jQuery(document.body).hasClass("sapUiSizeCozy") || jQuery(document.body).hasClass("sapUiSizeCompact")) {
					this._sContentDensityClass = "";
				} else if (!Device.support.touch) { // apply "compact" mode if touch is not supported
					this._sContentDensityClass = "sapUiSizeCompact";
				} else {
					// "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
					this._sContentDensityClass = "sapUiSizeCozy";
				}
			}
			return this._sContentDensityClass;
		},
		
		getErrorHandler: function() {
			return this._oErrorHandler;
		},
		
		getAssignmentId: function() {
			if (!this.sEmployeeId) {
				return CommonModelManager.getDefaultAssignment().then(function(oDefaultAssignment) {
					this.sEmployeeId = oDefaultAssignment.EmployeeId;
					return this.sEmployeeId;
				}.bind(this));
			} else {
				return Promise.resolve(this.sEmployeeId);
			}
		},
		setAssignmentId: function(sEmployeeId) {
			this.sEmployeeId = sEmployeeId;
		}
	});
});