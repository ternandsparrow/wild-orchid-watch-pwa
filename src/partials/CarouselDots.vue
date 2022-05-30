<template>
  <div class="dots-container" :style="extraStyles">
    <span
      v-for="dotIndex in dotIndexes"
      :key="dotIndex"
      class="dot"
      @click="onClick(dotIndex)"
    >
      <a :class="{ 'selected-dot': isSelectedDot(dotIndex) }">{{
        isSelectedDot(dotIndex) ? '\u25CF' : '\u25CB'
      }}</a>
    </span>
  </div>
</template>

<script>
export default {
  name: 'CarouselDots',
  props: {
    dotCount: {
      type: Number,
      required: true,
    },
    selectedIndex: {
      type: Number,
      required: true,
    },
    extraStyles: Object,
  },
  data() {
    return {
      carouselIndex: 0,
      dotIndexes: [],
    }
  },
  watch: {
    selectedIndex(val) {
      this.carouselIndex = val
    },
  },
  created() {
    for (let i = 0; i < this.dotCount; i += 1) {
      this.dotIndexes.push(i)
    }
    this.carouselIndex = this.selectedIndex
  },
  methods: {
    onClick(dotIndex) {
      this.carouselIndex = dotIndex
      this.$emit('dot-click', this.carouselIndex)
    },
    isSelectedDot(dotIndex) {
      return this.carouselIndex === dotIndex
    },
  },
}
</script>

<style lang="scss" scoped>
.dots-container {
  text-align: center;
  font-size: 3em;
  color: #fff;

  .dot {
    cursor: pointer;
    margin-left: 0.1em;
    margin-right: 0.1em;
  }

  .selected-dot {
    vertical-align: text-bottom;
  }
}
</style>
