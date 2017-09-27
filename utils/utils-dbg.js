/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([

], function () {
    "use strict";
    
    /* global Promise */

    /*
     * Returns a new Deferred object. new jQuery.Deferred() can be used
     * instead, however this returns a more standard ES6 Promise object
     * instead of jQuery promises.
     */
    function createDeferred () {
        var fnResolveDeferred;
        var fnRejectDeferred;

        var oPromise = new Promise(function (fnResolve, fnReject) {
            fnResolveDeferred = fnResolve.bind(null);
            fnRejectDeferred = fnReject.bind(null);
        });

        return {
            resolve: fnResolveDeferred,
            reject: fnRejectDeferred,
            promise: oPromise
        };
    }

    /**
     * A wrapper around sap.ui.core.routing.Router#navTo.
     *
     * Behaves exactly like navTo, but the navTo is executed
     * asynchronously. This ensures that all pending code
     * changes before the navigation are processed.
     *
     * IMPORTANT, call this method from a controller and make
     * sure to pass the controller as the context.
     */
    function navTo (/* sTarget, oArgs, bReplace */) {
        /* eslint-disable */
        var oController = this; // important!
        /* eslint-enable */

        var oRouter = sap.ui.core.UIComponent.getRouterFor(oController);
        var oArgs = arguments;

        setTimeout(function () {
            oRouter.navTo.apply(oRouter, oArgs);
        }, 0);
    }

    /**
     * Transforms a date into UTC (locale independent) format.
     *
     * @param {Date} [oDate]
     *   A Javascript Date object in locale time.
     *
     * @returns {Date}
     *   A Javascript Date in UTC format, or undefined if nothing or another
     *   falsy value is provided.
     */
    function dateToUTC (oDate) {
       if (!oDate) {
           return undefined;
       }

       return new Date(Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate()));
    }

    return {
        createDeferred: createDeferred,
        navTo: navTo,
        dateToUTC: dateToUTC 
    };

});
