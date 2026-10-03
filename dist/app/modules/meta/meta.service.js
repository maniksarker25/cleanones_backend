"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const client_model_1 = require("../client/client.model");
const worker_model_1 = require("../worker/worker.model");
const getDashboardMetaData = () => __awaiter(void 0, void 0, void 0, function* () {
    const [totalCustomer, totalProvider] = yield Promise.all([
        client_model_1.Client.countDocuments(),
        worker_model_1.Worker.countDocuments(),
    ]);
    return {
        totalCustomer,
        totalProvider,
        pendingReports: 0,
    };
});
const getCustomerChartData = (year) => __awaiter(void 0, void 0, void 0, function* () {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);
    const chartData = yield client_model_1.Client.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: startOfYear,
                    $lt: endOfYear,
                },
            },
        },
        {
            $group: {
                _id: { $month: '$createdAt' },
                totalUser: { $sum: 1 },
            },
        },
        {
            $project: {
                month: '$_id',
                totalUser: 1,
                _id: 0,
            },
        },
        {
            $sort: { month: 1 },
        },
    ]);
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ];
    const data = Array.from({ length: 12 }, (_, index) => {
        var _a;
        return ({
            month: months[index],
            totalUser: ((_a = chartData.find((item) => item.month === index + 1)) === null || _a === void 0 ? void 0 : _a.totalUser) || 0,
        });
    });
    const yearsResult = yield client_model_1.Client.aggregate([
        {
            $group: {
                _id: { $year: '$createdAt' },
            },
        },
        {
            $project: {
                year: '$_id',
                _id: 0,
            },
        },
        {
            $sort: { year: 1 },
        },
    ]);
    const yearsDropdown = yearsResult.map((item) => item.year);
    return {
        chartData: data,
        yearsDropdown,
    };
});
const getProviderChartData = (year) => __awaiter(void 0, void 0, void 0, function* () {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);
    const chartData = yield worker_model_1.Worker.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: startOfYear,
                    $lt: endOfYear,
                },
            },
        },
        {
            $group: {
                _id: { $month: '$createdAt' },
                totalUser: { $sum: 1 },
            },
        },
        {
            $project: {
                month: '$_id',
                totalUser: 1,
                _id: 0,
            },
        },
        {
            $sort: { month: 1 },
        },
    ]);
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ];
    const data = Array.from({ length: 12 }, (_, index) => {
        var _a;
        return ({
            month: months[index],
            totalUser: ((_a = chartData.find((item) => item.month === index + 1)) === null || _a === void 0 ? void 0 : _a.totalUser) || 0,
        });
    });
    const yearsResult = yield worker_model_1.Worker.aggregate([
        {
            $group: {
                _id: { $year: '$createdAt' },
            },
        },
        {
            $project: {
                year: '$_id',
                _id: 0,
            },
        },
        {
            $sort: { year: 1 },
        },
    ]);
    const yearsDropdown = yearsResult.map((item) => item.year);
    return {
        chartData: data,
        yearsDropdown,
    };
});
const getEarningChartData = (year) => __awaiter(void 0, void 0, void 0, function* () {
    return {
        chartData: [],
        totalEarning: 0,
        yearsDropdown: [],
    };
});
const getActivities = (query) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { frame } = query; // e.g., 'Last 24 Hours', 'Last Week', etc.
        const now = new Date();
        let currentStart = null;
        let previousStart = null;
        let previousEnd = null;
        // Calculate current and previous periods
        switch (frame) {
            case 'Last 24 Hours':
                currentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                previousStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
                previousEnd = currentStart;
                break;
            case 'Last Week':
                currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                previousEnd = currentStart;
                break;
            case 'Last Fortnight':
                currentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                previousStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
                previousEnd = currentStart;
                break;
            case 'Last Month':
                currentStart = new Date();
                currentStart.setMonth(now.getMonth() - 1);
                previousStart = new Date();
                previousStart.setMonth(now.getMonth() - 2);
                previousEnd = currentStart;
                break;
            case 'Last Year':
                currentStart = new Date();
                currentStart.setFullYear(now.getFullYear() - 1);
                previousStart = new Date();
                previousStart.setFullYear(now.getFullYear() - 2);
                previousEnd = currentStart;
                break;
            default:
                currentStart = null; // All time
                previousStart = null;
                previousEnd = null;
        }
        // Helper function to calculate % difference
        const calcPercentage = (current, previous) => {
            if (previous === 0)
                return current === 0 ? 0 : 100;
            return ((current - previous) / previous) * 100;
        };
        // Build filters
        const currentFilter = currentStart
            ? { createdAt: { $gte: currentStart } }
            : {};
        const previousFilter = previousStart && previousEnd
            ? { createdAt: { $gte: previousStart, $lt: previousEnd } }
            : {};
        // Run counts in parallel
        const [currentCustomers, prevCustomers, currentProviders, prevProviders,] = yield Promise.all([
            client_model_1.Client.countDocuments(currentFilter),
            previousStart ? client_model_1.Client.countDocuments(previousFilter) : 0,
            worker_model_1.Worker.countDocuments(currentFilter),
            previousStart ? worker_model_1.Worker.countDocuments(previousFilter) : 0,
        ]);
        return {
            customers: {
                count: currentCustomers,
                changePercent: calcPercentage(currentCustomers, prevCustomers),
            },
            providers: {
                count: currentProviders,
                changePercent: calcPercentage(currentProviders, prevProviders),
            },
            report: {
                count: 0,
                changePercent: 0,
            },
        };
    }
    catch (err) {
        console.error(err);
    }
});
const MetaService = {
    getDashboardMetaData,
    getCustomerChartData,
    getProviderChartData,
    getEarningChartData,
    getActivities,
};
exports.default = MetaService;
