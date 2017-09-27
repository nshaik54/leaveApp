/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
		"sap/ui/model/json/JSONModel",
		"sap/ui/Device"
	], function (JSONModel, Device) {
		"use strict";

		return {

			createDeviceModel : function () {
				var oModel = new JSONModel(Device);
				oModel.setDefaultBindingMode("OneWay");
				return oModel;
			}
		};
	}
);