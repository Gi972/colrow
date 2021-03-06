import React, { Component } from 'react';
import PropTypes from 'prop-types';
import slice from 'ramda/src/slice';

import { defaultComparator } from '../comparators';
import noop from '../utils/noop';
import defaultValueResolver from '../utils/valueResolver';
import sort, { SortingDirection } from '../utils/sorter';

export { SortingDirection };

export default class Colrow extends Component {
  static propTypes = {
    columns: PropTypes.arrayOf(
      PropTypes.object,
    ).isRequired,
    rows: PropTypes.arrayOf(
      PropTypes.any,
    ),
    render: PropTypes.func,
    comparator: PropTypes.func,
    sortingColumnIdx: PropTypes.number,
    sortingColumnDirection: PropTypes.oneOf(
      [SortingDirection.ASC, SortingDirection.DESC]
    ),
    onSorting: PropTypes.func,
    onSorted: PropTypes.func,
    onLoading: PropTypes.func,
    onLoaded: PropTypes.func,
    isLoading: PropTypes.bool,
    pageSize: PropTypes.number,
    pageNo: PropTypes.number,
  }

  static defaultProps = {
    rows: [],
    render: DefaultRenderer,
    comparator: defaultComparator,
    sortByColumnIdx: -1,
    sortDirection: null,
    onSorting: noop,
    onSorted: noop,
    onLoading: noop,
    onLoaded: noop,
    isLoading: false,
    pageSize: Infinity,
    pageNo: 1,
  }

  initialState = {
    visibleRows: extractVisibleRows({
      rows: this.props.rows,
      pageNo: this.props.pageNo,
      pageSize: this.props.pageSize,
    }),
    rows: this.props.rows,
    columns: this.props.columns,
    sorting: transformSortingPropsToState(Colrow.defaultProps),
  }

  state = { ...this.initialState }

  componentWillMount() {
    if (this.props.columns.length === 0) {
      throw Error('At least one column definition must be provided');
    }

    this.validateSortingProps(
      transformSortingPropsToState(Colrow.defaultProps),
      transformSortingPropsToState(this.props)
    );
    this.validateLoadingProps(Colrow.defaultProps.isLoading, this.props.isLoading);
  }

  componentWillReceiveProps(nextProps) {
    this.validateSortingProps(
      transformSortingPropsToState(this.props),
      transformSortingPropsToState(nextProps)
    );
    this.validateLoadingProps(this.props.isLoading, nextProps.isLoading);
  }

  render() {
    return this.props.render(this.getTableProps());
  }

  getCellProps = ({ idx, row: item, column = {} }) => {
    const { sorting } = this.state;
    const sortingDirection = idx != null && sorting.columnIdx === idx
      ? sorting.direction
      : null;

    const {
      itemKey = idx,
      valueResolver = defaultValueResolver,
    } = column;
    const value = item != null && idx != null
      ? valueResolver(item, itemKey)
      : null;

    return {
      value,
      sortingDirection
    };
  }

  getTableProps = () => {
    const {
      state,
      sort,
      getCellProps,
    } = this;
    const {
      rows,
      columns,
      visibleRows,
    } = state;

    const actions = {
      sort,
    };

    const stateItems = {
      rows,
      visibleRows,
      columns,
    };

    const utils = {
      getCellProps,
    };

    const tableProps = {
      ...actions,
      ...utils,
      ...stateItems,
    };

    return tableProps;
  }

  sort = ({
    columnIdx,
    direction = null,
  }) => {
    const {
      pageSize,
      columns,
      rows: initialRows,
      comparator: tableComparator,
    } = this.props;
    const {
      sorting,
      rows: collection,
    } = this.state;
    const nextSorting = getNextSorting({
      columnIdx,
      direction: sorting.direction,
      requestedDirection: direction,
    });

    const preventSorting = sorting.columnIdx === nextSorting.columnIdx
      && sorting.direction === nextSorting.direction;

    if (preventSorting) {
      return;
    }

    const columnToSort = columns[columnIdx] || {};
    const comparator = columnToSort.comparator || tableComparator;
    const itemKey = columnToSort.itemKey || columnIdx;

    this.props.onSorting({ sorting, nextSorting });

    const resetSorting = nextSorting.columnIdx === -1;
    const sortedRows = resetSorting
      ? initialRows
      : sort({
        collection,
        itemKey,
        comparator,
        valueResolver: columnToSort.valueResolver,
        direction: nextSorting.direction,
      });

    this.onSorted({
      sortedRows,
      pageSize,
      prevSorting: sorting,
      sorting: nextSorting,
    });
  }

  onSorted = ({ pageSize, prevSorting, sorting, sortedRows: rows }) => {
    const visibleRows = extractVisibleRows({ rows, from: 0, to: pageSize });

    this.setState(
      () => ({
        sorting,
        visibleRows,
        rows,
      }),
      () => this.props.onSorted({ prevSorting, sorting, rows, visibleRows }),
    );
  }

  validateSortingProps = (prevSorting, nextSorting) => {
    const shouldRunInitialSort = prevSorting.columnIdx !== nextSorting.columnIdx
      || prevSorting.direction !== nextSorting.direction;

    if(shouldRunInitialSort) {
      this.sort(transformSortingPropsToState(this.props));
    }
  }

  validateLoadingProps = (prevIsLoading, nextIsLoading) => {
    const hasToggledLogging = prevIsLoading !== nextIsLoading;

    if (hasToggledLogging) {
      if (nextIsLoading) {
        this.props.onLoading();
      } else {
        this.props.onLoaded();
      }
    }
  }
}

function getNextSorting({
  columnIdx,
  direction,
  requestedDirection,
}) {
  if (columnIdx === -1) {
    return {
      columnIdx,
      direction: null,
    };
  }

  const opositDirection = direction !== SortingDirection.ASC
    ? SortingDirection.ASC
    : SortingDirection.DESC;

  return {
    columnIdx: parseInt(columnIdx, 10),
    direction: requestedDirection != null
      ? requestedDirection
      : opositDirection,
  };
}

function extractVisibleRows({ pageNo, pageSize, rows }) {
  if (!isFinite(pageSize)) {
    return rows;
  }

  const from = evaluateFirstRowIdx(pageNo, pageSize);
  const to = evaluateLastRowIdx(pageNo, pageSize);

  return slice(from, to, rows);
}

function evaluateFirstRowIdx(pageNo, pageSize) {
  return (pageNo - 1) * pageSize;
}

function evaluateLastRowIdx(pageNo, pageSize) {
  return evaluateFirstRowIdx(pageNo, pageSize) + pageSize;
}

function transformSortingPropsToState({
  sortByColumnIdx: columnIdx,
  sortDirection: direction,
}) {
  return {
    columnIdx,
    direction,
  };
}

function DefaultRenderer(params) {
  return <div>Default</div>
}
