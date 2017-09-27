/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/model/json/JSONModel","sap/ui/Device"],function(J,D){"use strict";return{createDeviceModel:function(){var m=new J(D);m.setDefaultBindingMode("OneWay");return m;}};});
