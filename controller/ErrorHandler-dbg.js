/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/ui/core/message/Message",
	"sap/ui/core/MessageType"
], function(UI5Object, JSONModel, MessageBox, Message, MessageType) {
	"use strict";

	function fnExtractErrorContentFromResponse(sResponse) {
		var errorJSON,
			oError = {
				sMessage: sResponse,
				sDetails: null,
				aInnerErrors: []
			};

		try {
			// try to parse error as JSON-object first
			errorJSON = JSON.parse(sResponse);

			if (errorJSON && errorJSON.error) {
				if (errorJSON.error.message && errorJSON.error.message.value) {
					oError.sMessage = errorJSON.error.message.value;
				}
				if (errorJSON.error.code) {
					oError.sDetails = errorJSON.error.code;
				}
				if (errorJSON.error.innererror && errorJSON.error.innererror.errordetails) {
					oError.aInnerErrors = errorJSON.error.innererror.errordetails;
				}
			}

		} catch (e) {
			// xml is parsed using jQuery
			try {
				var xmlDoc = jQuery.parseXML(sResponse);
			} catch (f) {
				jQuery.sap.log.error(f);
			}

			if (xmlDoc) {
				oError.sMessage = xmlDoc.getElementsByTagName("message")[0].childNodes[0].nodeValue || xmlDoc.documentElement;
				oError.sDetails = xmlDoc.getElementsByTagName("code")[0].childNodes[0].nodeValue;
				oError.aInnerErrors = xmlDoc.getElementsByTagName("errordetail");
			} else {
				// Just in case that the Error from request could not be parsed
				oError.sMessage = sResponse;
			}
		}
		return oError;
	}

	function fnParseError(oEvent) {
		var oParameters = null,
			oResponse = null;

		// "getParameters": for the case of catching oDataModel "requestFailed" event
		oParameters = oEvent.getParameters ? oEvent.getParameters() : null;
		// "oParameters.response": V2 interface, response object is under the getParameters()
		// "oParameters": V1 interface, response is directly in the getParameters()
		// "oEvent" for the case of catching request "onError" event
		oResponse = oParameters ? (oParameters.response || oParameters) : oEvent;
		var responseContent = oResponse.responseText || oResponse.body || (oResponse.response && oResponse.response.body) || ""; //"onError" Event: V1 uses response and response.body
		return fnExtractErrorContentFromResponse(responseContent);
	}

	function fnGetMessageType(sSeverity) {
		switch (sSeverity) {
			case "error":
				return MessageType.Error;
			case "warning":
				return MessageType.Warning;
			case "info":
				return MessageType.Information;
			default:
				return MessageType.Error;
		}
	}

	return UI5Object.extend("hcm.fab.myleaverequest.controller.ErrorHandler", {

		/**
		 * Handles application errors by automatically attaching to the model events and displaying errors when needed.
		 * @class
		 * @param {sap.ui.core.UIComponent} oComponent reference to the app's component
		 * @public
		 */
		constructor: function(oComponent, oMessageProcessor, oMessageManager) {
			this._aErrors = [];
			this._showErrors = "immediately";

			this._oMessageManager = oMessageManager;
			this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
			this._oComponent = oComponent;
			this._oModel = oComponent.getModel();
			this._bMessageOpen = false;
			this._sErrorText = this._oResourceBundle.getText("errorTitle");

			this._oModel.attachMetadataFailed(function(oEvent) {
				var oParams = oEvent.getParameters();
				this._showMetadataError(oParams.response);
			}, this);

			this._oModel.attachRequestFailed(function(oEvent) {
				var oError = fnParseError(oEvent);

				// deal with main error message from response
				if (this._showErrors === "immediately") {
					this._showServiceError(oError.sMessage, oError.sDetails);
				} else {
					jQuery.sap.log.error("OData response error: " + oError.sMessage, oError.sDetails);
					this._aErrors.push(oError.sMessage);
				}

				// clear all previous messages
				oMessageManager.removeAllMessages();

				// put all other messages into the Message Manager
				oError.aInnerErrors.forEach(function(oInnerError) {
					if (oInnerError.message) {
						oMessageManager.addMessages(
							new Message({
								message: oInnerError.message,
								description: oInnerError.code,
								additionalText: oInnerError.code,
								type: fnGetMessageType(oInnerError.severity),
								processor: oMessageProcessor
							})
						);
					} else {
						oMessageManager.addMessages(
							new Message({
								message: oInnerError.getElementsByTagName("message").childNodes[0].nodeValue,
								description: oInnerError.getElementsByTagName("code").childNodes[0].nodeValue,
								additionalText: oInnerError.getElementsByTagName("code").childNodes[0].nodeValue,
								type: fnGetMessageType(oInnerError.getElementsByTagName("severity").childNodes[0].nodeValue),
								processor: oMessageProcessor
							})
						);
					}
				});
			}, this);
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when the metadata call has failed.
		 * The user can try to refresh the metadata.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showMetadataError: function(sDetails) {
			MessageBox.error(
				this._sErrorText, {
					id: "metadataErrorMessageBox",
					details: sDetails,
					styleClass: this._oComponent.getContentDensityClass(),
					actions: [MessageBox.Action.RETRY, MessageBox.Action.CLOSE],
					onClose: function(sAction) {
						if (sAction === MessageBox.Action.RETRY) {
							this._oModel.refreshMetadata();
						}
					}.bind(this)
				}
			);
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when a service call has failed.
		 * Only the first error message will be display.
		 *
		 * @param {string} sError a technical error to be displayed on request
		 *
		 * @param {boolean} bOneError whether one or multiple errors are displayed
		 * @private
		 */
		_showServiceError: function(sErrorText, sErrorDetails, sTitleText) {
			if (this._bMessageOpen) {
				return;
			}
			this._bMessageOpen = true;
			MessageBox.error(sErrorText, {
				id: "serviceErrorMessageBox",
				title: sTitleText ? sTitleText : this._sErrorText,
				details: sErrorDetails,
				styleClass: this._oComponent.getContentDensityClass(),
				actions: [MessageBox.Action.CLOSE],
				onClose: function() {
					this._bMessageOpen = false;
				}.bind(this)
			});
		},

		clearErrors: function() {
			this._oMessageManager.removeAllMessages();
		},

		/**
		 * Decides in what way to show request errors from now on.
		 *
		 * @param {string} sOption
		 *    one of: "immediately", "manual"
		 *
		 * - "immediately" a popup is shown as soon as one error occurs.
		 * - "manual" errors are collected and popup is only shown when
		 *   the 'displayErrorPopup' is called.
		 */
		setShowErrors: function(sOption) {
			this._showErrors = sOption;
		},
		/**
		 * Pushes an error to the error queue. The error can then be
		 * displayed by calling displayErrorPopup.
		 *
		 * @param {string} sMessage
		 *   The error message.
		 *
		 */
		pushError: function(sMessage) {
			if (sMessage) {
				this._aErrors.push(sMessage);
			}
		},
		/**
		 * Returns whether there are pending error messages.
		 *
		 * @returns {boolean}
		 *  Whether there are errors
		 *
		 */
		hasPendingErrors: function() {
			return this._aErrors.length > 0;
		},
		/**
		 * Displays error popups on demand, and clears the queue of errors.
		 *
		 * @returns {boolean}
		 *   true if errors were displayed, false otherwise.
		 */
		displayErrorPopup: function() {
			if (this._aErrors.length === 0) {
				return false;
			}

			var sErrors = this._aErrors.join("\n");

			this._showServiceError(sErrors);

			this._aErrors = [];

			return true;
		}
	});
});