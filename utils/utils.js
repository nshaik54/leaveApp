/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([],function(){"use strict";function c(){var r;var R;var p=new Promise(function(f,a){r=f.bind(null);R=a.bind(null);});return{resolve:r,reject:R,promise:p};}function n(){var C=this;var r=sap.ui.core.UIComponent.getRouterFor(C);var a=arguments;setTimeout(function(){r.navTo.apply(r,a);},0);}function d(D){if(!D){return undefined;}return new Date(Date.UTC(D.getFullYear(),D.getMonth(),D.getDate()));}return{createDeferred:c,navTo:n,dateToUTC:d};});
