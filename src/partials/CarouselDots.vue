<template>
  <div :style="dotsStyle">
    <span
      v-for="dotIndex in dotIndexes"
      :key="dotIndex"
      style="cursor: pointer"
      @click="onClick(dotIndex)"
    >
      {{ carouselIndex === dotIndex ? '\u25CF' : '\u25CB' }}
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
  },
  data() {
    return {
      carouselIndex: 0,
      dotIndexes: [],
      dotsStyle: {
        textAlign: 'center',
        fontSize: '30px',
        color: '#fff',
        position: 'absolute',
        bottom: '40px',
        left: 0,
        right: 0,
      },
    }
  },
  created() {
    for (let i = 0; i < this.dotCount; i++) {
      this.dotIndexes.push(i)
    }
    this.carouselIndex = this.selectedIndex
  },
  watch: {
    selectedIndex(val) {
      this.carouselIndex = val
    },
  },
  methods: {
    onClick(dotIndex) {
      this.carouselIndex = dotIndex
      this.$emit('dot-click', this.carouselIndex)
    },
  },
}
</script>
