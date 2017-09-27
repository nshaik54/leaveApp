/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/core/mvc/Controller"],function(C){"use strict";return C.extend("hcm.fab.myleaverequest.controller.BaseController",{getRouter:function(){return sap.ui.core.UIComponent.getRouterFor(this);},getModel:function(n){return this.getView().getModel(n);},setModel:function(m,n){return this.getView().setModel(m,n);},getResourceBundle:function(){return this.getOwnerComponent().getModel("i18n").getResourceBundle();}});});
