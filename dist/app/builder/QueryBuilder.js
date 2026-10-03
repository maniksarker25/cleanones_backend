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
class QueryBuilder {
    constructor(modelQuery, query) {
        this.modelQuery = modelQuery;
        this.query = query;
    }
    search(searchableFields) {
        var _a;
        const searchTerm = (_a = this === null || this === void 0 ? void 0 : this.query) === null || _a === void 0 ? void 0 : _a.searchTerm;
        if (searchTerm) {
            this.modelQuery = this === null || this === void 0 ? void 0 : this.modelQuery.find({
                $or: searchableFields.map((field) => ({
                    [field]: { $regex: searchTerm, $options: 'i' },
                })),
            });
        }
        return this;
    }
    filter() {
        const queryObj = Object.assign({}, this.query); // copy the query
        const excludeFields = ['searchTerm', 'sort', 'limit', 'page', 'fields'];
        excludeFields.forEach((el) => delete queryObj[el]);
        this.modelQuery = this.modelQuery.find(queryObj);
        return this;
    }
    // sort() {
    //   const sort =
    //     (this?.query?.sort as string)?.split(',')?.join(' ') || '-createdAt';
    //   this.modelQuery = this.modelQuery.sort(sort as string);
    //   return this;
    // }
    sort() {
        const sortField = this.query.sort;
        if (sortField) {
            // Check if the sortField starts with '-' (indicating descending order)
            const order = sortField.startsWith('-') ? -1 : 1;
            const fieldName = sortField.replace('-', '');
            // Dynamic sorting based on any field provided in the query
            this.modelQuery = this.modelQuery.sort({
                [fieldName]: order,
            });
        }
        else {
            // Default sorting if no valid sort option is provided
            this.modelQuery = this.modelQuery.sort('-createdAt');
        }
        return this;
    }
    paginate() {
        const page = Number(this === null || this === void 0 ? void 0 : this.query.page) || 1;
        const limit = Number(this === null || this === void 0 ? void 0 : this.query.limit) || 10;
        const skip = (page - 1) * limit;
        this.modelQuery = this.modelQuery.skip(skip).limit(limit);
        return this;
    }
    fields() {
        var _a, _b, _c;
        const fields = ((_c = (_b = (_a = this === null || this === void 0 ? void 0 : this.query) === null || _a === void 0 ? void 0 : _a.fields) === null || _b === void 0 ? void 0 : _b.split(',')) === null || _c === void 0 ? void 0 : _c.join(' ')) || '-_v';
        this.modelQuery = this.modelQuery.select(fields);
        return this;
    }
    countTotal() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const totalQueries = this.modelQuery.getFilter();
            const total = yield this.modelQuery.model.countDocuments(totalQueries);
            const page = Number((_a = this === null || this === void 0 ? void 0 : this.query) === null || _a === void 0 ? void 0 : _a.page) || 1;
            const limit = Number((_b = this === null || this === void 0 ? void 0 : this.query) === null || _b === void 0 ? void 0 : _b.limit) || 10;
            const totalPage = Math.ceil(total / limit);
            return {
                page,
                limit,
                total,
                totalPage,
            };
        });
    }
}
exports.default = QueryBuilder;
