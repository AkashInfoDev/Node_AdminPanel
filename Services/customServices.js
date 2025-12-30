class customServices {
    static GetEmptyRow(array, criteria, returnOne = false, blank = false) {
        if (Object.keys(array).includes('recordset')) {
            array = array.recordset;
        }
        const parseCriteria = (criteriaString) => {
            const conditions = criteriaString.split('AND').map(condition => condition.trim());
            let parsedConditions = {};
            conditions.forEach(condition => {
                const regex = /(\w+)\s*=\s*'(.*)'/;
                const match = condition.match(regex);
                if (match) {
                    parsedConditions[match[1]] = match[2];
                }
            });
            return Object.keys(parsedConditions).length > 0 ? parsedConditions : null;
        };
        let parsedCriteria = '';
        if (criteria && typeof criteria === 'string') {
            parsedCriteria = criteria;
            parsedCriteria = parseCriteria(criteria);
            if (!parsedCriteria) {
                return null;
            }
        }
        let dt = array.filter((item) => {
            return Object.entries(parsedCriteria).every(([field, value]) => item[field?.trim()] == value);
        });

        if (dt.length > 0 && !blank) {
            if (returnOne) {
                return dt[0];
            } else {
                return dt;
            }
        } else {
            if (array.length === 0 && array.hasOwnProperty('columns')) {
                let emptyObj = {};
                Object.keys(array.columns).forEach(key => {
                    let val = array.columns[key];
                    if (val.type.declaration === 'varchar') emptyObj[key] = "";
                    else if (val.type.declaration === 'nvarchar') emptyObj[key] = "";
                    else if (val.type.declaration === 'char') emptyObj[key] = "";
                    else if (val.type.declaration === 'text') emptyObj[key] = "";
                    else if (val.type.declaration === 'numaric' || val.type.declaration === 'numeric') emptyObj[key] = 0;
                    else if (val.type.declaration === 'int') emptyObj[key] = 0;
                    else if (val.type.declaration === 'boolean') emptyObj[key] = false;
                });
                return emptyObj;
            } else if (array) {
                let newRow = {};
                for (let key in array[0]) {
                    if (typeof array[0][key] === 'string') {
                        newRow[key] = '';
                    } else if (typeof array[0][key] === 'number') {
                        newRow[key] = 0;
                    } else if (Array.isArray(array[0][key])) {
                        newRow[key] = [];
                    } else if (array[0][key] !== null && typeof array[0][key] === 'object') {
                        newRow[key] = {}; // or recursively call resetValues if deep
                    } else if (typeof array[0][key] === 'boolean') {
                        newRow[key] = false;
                    } else {
                        newRow[key] = null; // fallback for null, undefined, functions, etc.
                    }
                }
                return newRow;
            } else {
                return null;
            }
        }
    }

    static formatDate(date) {
    // Extract the components
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    let day = String(date.getDate()).padStart(2, '0');
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    let seconds = String(date.getSeconds()).padStart(2, '0');
    let milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    // Return the formatted string
    console.log(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

module.exports = customServices;