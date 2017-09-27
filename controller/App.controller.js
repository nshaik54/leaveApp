/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["hcm/fab/myleaverequest/controller/BaseController","sap/ui/model/json/JSONModel"],function(B,J){"use strict";return B.extend("hcm.fab.myleaverequest.controller.App",{onInit:function(){var v,s,o=this.getView().getBusyIndicatorDelay();v=new J({busy:true,delay:0});this.setModel(v,"appView");s=function(){v.setProperty("/busy",false);v.setProperty("/delay",o);};this.getOwnerComponent().getModel().metadataLoaded().then(s);this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());}});});
